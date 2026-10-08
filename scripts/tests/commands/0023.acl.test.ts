/**
 * ACL commands: user management, category introspection, password generation,
 * dry-run, and log inspection.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RespError, SolidisCommandError } from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  detectServerCapabilities,
  resolveConnectionTarget,
  uniqueSuffix,
  withoutSanitizePayload,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('acl', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  let atLeast72 = false;
  let atLeast8 = false;
  let isValkey = false;
  const trackedUsers: string[] = [];

  const createTestUser = () => {
    const name = `solidis-test-${uniqueSuffix()}`;
    trackedUsers.push(name);
    return name;
  };

  before(async () => {
    client = await createClient();
    const capabilities = await detectServerCapabilities(client);
    atLeast7 = capabilities.atLeast(7, 0);
    atLeast72 = capabilities.atLeast(7, 2);
    atLeast8 = capabilities.atLeast(8, 0);
    isValkey = capabilities.isValkey;
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
    /** The suites connect without credentials, as the default user. */
    assert.strictEqual(await client.aclWhoami(), 'default');
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

    if (atLeast7) {
      assert.deepStrictEqual(
        { ...info, flags: withoutSanitizePayload(info.flags) },
        {
          flags: ['on'],
          passwords: [
            '9b8769a4a742959a2d0298c36fb70623f2dfacda8436237df08d8dfd5b37374c',
          ],
          commands: '+@all',
          keys: '~*',
          channels: '',
          selectors: [],
        },
      );
    } else {
      assert.deepStrictEqual(info, {
        flags: ['on', 'allkeys', 'allchannels', 'allcommands'],
        passwords: [
          '9b8769a4a742959a2d0298c36fb70623f2dfacda8436237df08d8dfd5b37374c',
        ],
        commands: '+@all',
        keys: '~*',
        channels: '&*',
        selectors: [],
      });
    }

    assert.strictEqual(await client.aclDeluser(user), 1);

    const deleted = await client.aclGetuser(user);

    assert.strictEqual(deleted, null);
  });

  it('authenticates a binary username byte for byte with AUTH and HELLO', async () => {
    const name = Buffer.from([0x75, 0xff]);
    const password = `binary-${uniqueSuffix()}`;
    const protocol = resolveConnectionTarget().protocol ?? 'RESP2';
    const user = await createClient();

    await client.send([
      ['ACL', 'SETUSER', name, 'on', `>${password}`, '~*', '+@all'],
    ]);

    try {
      for (const attempt of [
        user.auth(name.toString(), password),
        user.hello(protocol, name.toString(), password),
      ]) {
        await assert.rejects(attempt, (error: unknown) => {
          assert.ok(error instanceof SolidisCommandError);
          assert.ok(error.cause instanceof RespError);
          assert.strictEqual(error.cause.code, 'WRONGPASS');

          return true;
        });
      }

      assert.strictEqual(await user.auth(name, password), 'OK');
      assert.strictEqual(
        (await user.hello(protocol, name, password)).proto,
        protocol === 'RESP3' ? 3 : 2,
      );
    } finally {
      await closeClient(user);
      await client.send([['ACL', 'DELUSER', name]]);
    }
  });

  it('answers a failed AUTH and HELLO with AUTH sent between other commands', async () => {
    const key = `solidis-test-auth-${uniqueSuffix()}`;
    const protocol = resolveConnectionTarget().protocol ?? 'RESP2';
    const user = await createClient();

    try {
      const [pong, auth, hello, set] = await Promise.allSettled([
        user.ping(),
        user.auth('solidis-missing-user', 'wrong'),
        user.hello(protocol, 'solidis-missing-user', 'wrong'),
        user.set(key, 'v'),
      ]);

      assert.deepStrictEqual(pong, { status: 'fulfilled', value: 'PONG' });

      for (const result of [auth, hello]) {
        assert.strictEqual(result.status, 'rejected');
        assert.ok(result.reason instanceof SolidisCommandError);
        assert.ok(result.reason.cause instanceof RespError);
        assert.strictEqual(result.reason.cause.code, 'WRONGPASS');
      }

      assert.deepStrictEqual(set, { status: 'fulfilled', value: 'OK' });
      assert.strictEqual(await user.get(key), 'v');
    } finally {
      await user.del(key);
      await closeClient(user);
    }
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
    if (!(denied instanceof Error)) {
      assert.fail('expected the SET command to be rejected by the ACL');
    }
    if (atLeast72) {
      assert.strictEqual(
        denied.message,
        `[SET] NOPERM User ${user} has no permissions to run the 'set' command`,
      );
    } else {
      assert.strictEqual(
        denied.message,
        "[SET] NOPERM this user has no permissions to run the 'set' command or its subcommand",
      );
    }

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
      for (const denied of [
        restricted.set('forbidden:key', 'val'),
        restricted.get('forbidden:key'),
      ]) {
        await assert.rejects(
          denied,
          (error: unknown) =>
            error instanceof SolidisCommandError &&
            error.cause instanceof RespError &&
            error.cause.code === 'NOPERM',
        );
      }
    } finally {
      await closeClient(restricted);
    }

    const all = await client.aclLog();
    const latest = await client.aclLog(1);

    assert.strictEqual(all.length, 2);
    assert.strictEqual(latest.length, 1);
    assert.strictEqual(latest[0].username, user);
    assert.deepStrictEqual(
      [latest[0].reason, latest[0].object],
      [all[0].reason, all[0].object],
    );
  });

  it('resets the ACL log', async () => {
    const log = await client.aclLog('RESET');

    assert.deepStrictEqual(log, []);
  });

  it('refuses ACL SAVE without an ACL file and accepts it with one', async () => {
    /**
     * ACL SAVE returns OK when the server is configured with an aclfile; with
     * the default in-memory configuration it must fail with a *specific* error
     * rather than any arbitrary rejection.
     */
    const result = await client.aclSave().catch((error: Error) => error);

    if (result instanceof Error) {
      assert.ok(result instanceof SolidisCommandError);
      assert.ok(result.cause instanceof RespError);
      assert.strictEqual(result.cause.code, 'ERR');
      if (isValkey && atLeast8) {
        assert.strictEqual(
          result.message,
          '[ACL SAVE] ERR This instance is not configured to use an ACL file. You may want to specify users via the ACL SETUSER command and then issue a CONFIG REWRITE (assuming you have a configuration file set) in order to store users in the configuration.',
        );
      } else {
        assert.strictEqual(
          result.message,
          '[ACL SAVE] ERR This Redis instance is not configured to use an ACL file. You may want to specify users via the ACL SETUSER command and then issue a CONFIG REWRITE (assuming you have a Redis configuration file set) in order to store users in the Redis configuration.',
        );
      }
      return;
    }

    assert.strictEqual(result, 'OK');
  });
});
