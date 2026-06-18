/**
 * ACL commands: user management, category introspection, password generation,
 * dry-run, and log inspection.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  detectServerCapabilities,
  uniqueSuffix,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('acl', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const trackedUsers: string[] = [];

  const createTestUser = () => {
    const name = `solidis-test-${uniqueSuffix()}`;
    trackedUsers.push(name);
    return name;
  };

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    for (const user of trackedUsers) {
      try {
        await client.aclDeluser(user);
      } catch {
        /* user may not have been created */
      }
    }
    await closeClient(client);
  });

  it('reports the current user with ACL WHOAMI', async () => {
    const whoami = await client.aclWhoami();

    /**
     * The test harness connects either anonymously or with explicit
     * credentials; in both cases redis reports the `default` user unless a
     * dedicated username is supplied, which the environment helper exposes.
     */
    const expected = process.env.SOLIDIS_TEST_USERNAME || 'default';

    assert.strictEqual(whoami, expected);
  });

  it('lists ACL categories with ACL CAT', async () => {
    const categories = await client.aclCat();

    assert.ok(Array.isArray(categories));
    assert.ok(categories.length > 0);
    assert.ok(categories.includes('read'));
    assert.ok(categories.includes('write'));
  });

  it('lists commands in a category with ACL CAT <category>', async () => {
    const commands = await client.aclCat('string');

    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
  });

  it('generates a random password with ACL GENPASS', async () => {
    const password = await client.aclGenpass();

    assert.strictEqual(typeof password, 'string');
    assert.match(password, /^[0-9a-f]+$/);
    assert.strictEqual(password.length, 64);
  });

  it('generates a password with custom bit length', async () => {
    const password = await client.aclGenpass(128);

    assert.strictEqual(typeof password, 'string');
    assert.match(password, /^[0-9a-f]+$/);
    assert.strictEqual(password.length, 32);
  });

  it('lists all users with ACL USERS', async () => {
    const users = await client.aclUsers();

    assert.ok(Array.isArray(users));
    assert.ok(users.includes('default'));
  });

  it('lists all ACL rules with ACL LIST', async () => {
    const list = await client.aclList();

    assert.ok(Array.isArray(list));
    assert.ok(list.length > 0);
    assert.ok(list.some((entry) => entry.includes('default')));
  });

  it('creates, inspects, and deletes a user', async () => {
    const user = createTestUser();

    assert.strictEqual(
      await client.aclSetuser(user, 'on', '>pass123', '~*', '+@all'),
      'OK',
    );

    const info = await client.aclGetuser(user);

    assert.notStrictEqual(info, null);
    assert.ok(info?.flags.includes('on'));

    assert.strictEqual(await client.aclDeluser(user), 1);

    const deleted = await client.aclGetuser(user);

    assert.strictEqual(deleted, null);
  });

  it('returns null from ACL GETUSER for non-existent user', async () => {
    const result = await client.aclGetuser('nonexistent-user-solidis-probe');

    assert.strictEqual(result, null);
  });

  it('dry-runs a command for a user with ACL DRYRUN', async (context) => {
    if (!atLeast7) {
      context.skip('ACL DRYRUN requires Redis 7.0+');
      return;
    }

    const user = createTestUser();

    await client.aclSetuser(user, 'on', '>pass', '~*', '+get', '-set');

    const allowedResult = await client.aclDryrun(user, 'GET', ['anykey']);

    assert.strictEqual(allowedResult, 'OK');

    const deniedResult = await client.aclDryrun(user, 'SET', ['key', 'val']);

    assert.notStrictEqual(deniedResult, 'OK');
  });

  it('retrieves the ACL log with parsed entries', async () => {
    const user = createTestUser();

    await client.aclSetuser(user, 'on', '>pass', '~allowed:*', '+get', '-set');

    const restricted = await createClient({
      authentication: { username: user, password: 'pass' },
      enableReadyCheck: false,
    });

    let denied: unknown;

    try {
      denied = await restricted
        .set('forbidden:key', 'val')
        .then(() => null)
        .catch((error: Error) => error);
    } finally {
      await closeClient(restricted);
    }

    /**
     * The write must be rejected by the key ACL, otherwise the rest of the
     * assertions about the audit log would be meaningless.
     */
    assert.ok(denied instanceof Error);
    assert.match(`${denied}`, /NOPERM|no permissions/i);

    const log = await client.aclLog();

    assert.ok(Array.isArray(log));
    assert.ok(
      log.length > 0,
      'ACL LOG must record the denied write from the restricted user',
    );

    const entry = log.find((candidate) => candidate.username === user);

    assert.ok(entry, `expected an ACL log entry for user ${user}`);
    assert.strictEqual(typeof entry.count, 'number');
    assert.ok(entry.count >= 1);
    /** Redis reports the first violation; for `-set ~allowed:*` that is the command rule. */
    assert.ok(
      ['command', 'key', 'channel', 'auth'].includes(entry.reason),
      `unexpected ACL log reason: ${entry.reason}`,
    );
    assert.strictEqual(typeof entry.context, 'string');
    assert.strictEqual(typeof entry.ageSeconds, 'number');
    assert.strictEqual(typeof entry.clientInfo, 'string');
  });

  it('retrieves the ACL log with a count limit', async () => {
    const log = await client.aclLog(5);

    assert.ok(Array.isArray(log));
    assert.ok(log.length <= 5);
  });

  it('resets the ACL log', async () => {
    const log = await client.aclLog('RESET');

    assert.ok(Array.isArray(log));
    assert.strictEqual(log.length, 0);
  });

  it('persists ACL rules with ACL SAVE', async () => {
    /**
     * ACL SAVE returns OK when the server is configured with an aclfile; with
     * the default in-memory configuration it must fail with a *specific* error
     * rather than any arbitrary rejection.
     */
    const result = await client.aclSave().catch((error: Error) => error);

    if (result instanceof Error) {
      assert.match(`${result}`, /ACL file|aclfile|not configured/i);
      return;
    }

    assert.strictEqual(result, 'OK');
  });
});
