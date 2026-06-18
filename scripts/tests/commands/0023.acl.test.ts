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

    assert.ok(categories.includes('read'));
    assert.ok(categories.includes('write'));
    assert.ok(categories.includes('string'));
    assert.ok(categories.includes('connection'));
  });

  it('lists commands in a category with ACL CAT <category>', async () => {
    const commands = await client.aclCat('string');

    assert.ok(commands.includes('get'));
    assert.ok(commands.includes('set'));
    assert.ok(commands.includes('append'));
  });

  it('generates a random password with ACL GENPASS', async () => {
    const password = await client.aclGenpass();

    assert.match(password, /^[0-9a-f]+$/);
    assert.strictEqual(password.length, 64);
  });

  it('generates a password with custom bit length', async () => {
    const password = await client.aclGenpass(128);

    assert.match(password, /^[0-9a-f]+$/);
    assert.strictEqual(password.length, 32);
  });

  it('lists all users with ACL USERS', async () => {
    const users = await client.aclUsers();

    assert.ok(users.includes('default'));
  });

  it('lists all ACL rules with ACL LIST', async () => {
    const list = await client.aclList();

    assert.ok(
      list.some((entry) => entry.startsWith('user default on')),
      'ACL LIST must include the default user entry',
    );
  });

  it('creates, inspects, and deletes a user', async () => {
    const user = createTestUser();

    assert.strictEqual(
      await client.aclSetuser(user, 'on', '>pass123', '~*', '+@all'),
      'OK',
    );

    const info = await client.aclGetuser(user);

    if (info === null) {
      assert.fail('ACL GETUSER must return user info for an active user');
    }

    assert.deepStrictEqual(info, {
      flags: ['on', 'sanitize-payload'],
      passwords: [
        '9b8769a4a742959a2d0298c36fb70623f2dfacda8436237df08d8dfd5b37374c',
      ],
      commands: '+@all',
      keys: '~*',
      channels: '',
      selectors: [],
    });

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

    assert.strictEqual(
      deniedResult,
      `User ${user} has no permissions to run the 'set' command`,
    );
  });

  it('retrieves the ACL log with parsed entries', async () => {
    const user = createTestUser();

    await client.aclLog('RESET');
    await client.aclSetuser(user, 'on', '>pass', '~allowed:*', '+@all', '-set');

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
     * The write must be rejected by the command ACL, otherwise the rest of the
     * assertions about the audit log would be meaningless.
     */
    assert.ok(denied instanceof Error);
    assert.strictEqual(
      denied.message,
      `[SET forbidden:key val] Invalid reply: RespError: NOPERM User ${user} has no permissions to run the 'set' command`,
    );

    const log = await client.aclLog();

    assert.strictEqual(log.length, 1);

    const entry = log[0];

    assert.deepStrictEqual(
      {
        count: entry.count,
        reason: entry.reason,
        context: entry.context,
        object: entry.object,
        username: entry.username,
      },
      {
        count: 1,
        reason: 'command',
        context: 'toplevel',
        object: 'set',
        username: user,
      },
    );
  });

  it('retrieves the ACL log with a count limit', async () => {
    await client.aclLog('RESET');

    const user = createTestUser();

    await client.aclSetuser(user, 'on', '>pass', '~allowed:*', '+@all', '-set');

    const restricted = await createClient({
      authentication: { username: user, password: 'pass' },
      enableReadyCheck: false,
    });

    try {
      await restricted.set('forbidden:key', 'val');
    } catch {
      /* expected NOPERM */
    } finally {
      await closeClient(restricted);
    }

    const log = await client.aclLog(5);

    assert.strictEqual(log.length, 1);
    assert.strictEqual(log[0].username, user);
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
      assert.strictEqual(
        result.message,
        '[ACL SAVE] Invalid reply: RespError: ERR This Redis instance is not configured to use an ACL file. You may want to specify users via the ACL SETUSER command and then issue a CONFIG REWRITE (assuming you have a Redis configuration file set) in order to store users in the Redis configuration.',
      );
      return;
    }

    assert.strictEqual(result, 'OK');
  });
});
