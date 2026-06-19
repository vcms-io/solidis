/**
 * CLIENT and COMMAND subcommands: introspection, lifecycle management,
 * and server command metadata.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../../utils/index.ts';

/** Parses a CLIENT INFO / CLIENT LIST line into key/value fields. */
function parseClientFields(line: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const token of line.trim().split(/\s+/)) {
    const separatorIndex = token.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    fields[token.slice(0, separatorIndex)] = token.slice(separatorIndex + 1);
  }

  return fields;
}

/** Parses CLIENT LIST output into one record per connected client. */
function parseClientList(list: string): Record<string, string>[] {
  return list
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseClientFields);
}

describe('client-commands', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  const keyspace = createKeyspace('client-commands');

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
  });

  after(async () => {
    await closeClient(client);
  });

  it('returns connection info with CLIENT INFO', async () => {
    const info = await client.clientInfo();
    const fields = parseClientFields(info.split('\n')[0] ?? info);

    assert.ok(
      Number.parseInt(fields.id ?? '', 10) > 0,
      `expected positive client id, got ${fields.id}`,
    );
    assert.ok(
      Number.parseInt(fields.fd ?? '', 10) >= 0,
      `expected non-negative file descriptor, got ${fields.fd}`,
    );
    assert.strictEqual(fields.name, 'solidis');
  });

  it('lists connected clients with CLIENT LIST', async () => {
    const list = await client.clientList();
    const clients = parseClientList(list);

    assert.ok(clients.length > 0);
    assert.ok(
      clients.every((entry) => Number.parseInt(entry.id ?? '', 10) > 0),
    );
  });

  it('filters CLIENT LIST by type', async () => {
    const list = await client.clientList({ type: 'NORMAL' });
    const clients = parseClientList(list);

    assert.ok(clients.length > 0);
    assert.ok(clients.every((entry) => entry.flags?.includes('N') === true));
  });

  it('sets client library info with CLIENT SETINFO', async (context) => {
    if (!capabilities.atLeast(7, 2)) {
      context.skip('CLIENT SETINFO requires Redis 7.2+');
      return;
    }

    assert.strictEqual(
      await client.clientSetinfo('LIB-NAME', 'solidis-test'),
      'OK',
    );
    assert.strictEqual(await client.clientSetinfo('LIB-VER', '1.0.0'), 'OK');
  });

  it('pauses and unpauses clients', async () => {
    assert.strictEqual(await client.clientPause(100), 'OK');
    assert.strictEqual(await client.clientUnpause(), 'OK');
  });

  it('toggles eviction protection with CLIENT NO-EVICT', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('CLIENT NO-EVICT requires Redis 7.0+');
      return;
    }

    assert.strictEqual(await client.clientNoEvict('ON'), 'OK');
    assert.strictEqual(await client.clientNoEvict('OFF'), 'OK');
  });

  it('toggles LRU touch with CLIENT NO-TOUCH', async (context) => {
    if (!capabilities.atLeast(7, 2)) {
      context.skip('CLIENT NO-TOUCH requires Redis 7.2+');
      return;
    }

    assert.strictEqual(await client.clientNoTouch('ON'), 'OK');
    assert.strictEqual(await client.clientNoTouch('OFF'), 'OK');
  });

  it('returns redirect target with CLIENT GETREDIR', async () => {
    const redirect = await client.clientGetredir();

    assert.strictEqual(redirect, -1);
  });

  it('reports total command count with COMMAND COUNT', async () => {
    const count = await client.commandCount();

    assert.ok(
      count > 100,
      `expected more than 100 commands from COMMAND COUNT, got ${count}`,
    );
    assert.strictEqual(await client.commandCount(), count);
  });

  it('lists commands with COMMAND LIST', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND LIST requires Redis 7.0+');
      return;
    }

    const commands = await client.commandList();

    assert.ok(commands.length > 100);
    assert.ok(commands.includes('get'));
    assert.ok(commands.includes('set'));
    assert.ok(commands.includes('ping'));
    assert.ok(commands.includes('del'));
  });

  it('filters COMMAND LIST by pattern', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND LIST requires Redis 7.0+');
      return;
    }

    const commands = await client.commandList({ pattern: 'z*' });

    assert.ok(commands.length > 0);
    assert.deepStrictEqual(
      commands,
      commands.filter((command) => command.startsWith('z')),
    );
  });

  it('filters COMMAND LIST by module', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND LIST requires Redis 7.0+');
      return;
    }

    if (!capabilities.hasModule('ReJSON')) {
      context.skip('RedisJSON module not loaded');
      return;
    }

    const commands = await client.commandList({ module: 'ReJSON' });

    assert.ok(commands.length > 0, 'expected RedisJSON commands');
    assert.ok(
      commands.every((name) => name.toLowerCase().startsWith('json.')),
      'every RedisJSON command must be namespaced under json.',
    );
  });

  it('filters COMMAND LIST by aclcat', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND LIST requires Redis 7.0+');
      return;
    }

    const commands = await client.commandList({ aclcat: 'string' });

    assert.ok(commands.length > 0);
    assert.ok(commands.includes('get'));
    assert.ok(commands.includes('set'));
  });

  it('extracts keys from a command with COMMAND GETKEYS', async () => {
    const keys = await client.commandGetkeys('GET', ['mykey']);

    assert.deepStrictEqual(keys, ['mykey']);
  });

  it('extracts multiple keys with COMMAND GETKEYS', async () => {
    const keys = await client.commandGetkeys('MGET', ['key1', 'key2', 'key3']);

    assert.deepStrictEqual(keys, ['key1', 'key2', 'key3']);
  });

  it('extracts keys and flags with COMMAND GETKEYSANDFLAGS', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND GETKEYSANDFLAGS requires Redis 7.0+');
      return;
    }

    const result = await client.commandGetkeysandflags('SET', ['mykey', 'val']);

    assert.deepStrictEqual(result, [{ key: 'mykey', flags: ['OW', 'update'] }]);
  });

  it('retrieves command documentation with COMMAND DOCS', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND DOCS requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['get']);

    assert.strictEqual(docs.get.summary, 'Returns the string value of a key.');
    assert.strictEqual(docs.get.since, '1.0.0');
    assert.strictEqual(docs.get.group, 'string');
    assert.strictEqual(docs.get.complexity, 'O(1)');
  });

  it('parses COMMAND DOCS with history and arguments', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND DOCS requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['set']);

    const setDoc = docs.set;

    assert.strictEqual(
      setDoc.summary,
      "Sets the string value of a key, ignoring its type. The key is created if it doesn't exist.",
    );
    assert.strictEqual(setDoc.since, '1.0.0');
    assert.strictEqual(setDoc.group, 'string');
    assert.strictEqual(setDoc.complexity, 'O(1)');
    if (!Array.isArray(setDoc.history)) {
      assert.fail('expected history array in SET docs');
    }
    assert.strictEqual(
      setDoc.history[0],
      '2.6.12: Added the `EX`, `PX`, `NX` and `XX` options.',
    );
    if (!Array.isArray(setDoc.arguments)) {
      assert.fail('expected arguments array in SET docs');
    }
    assert.strictEqual(setDoc.arguments[0].name, 'key');
    assert.strictEqual(setDoc.arguments[0].type, 'key');
  });

  it('parses COMMAND DOCS for a deprecated command', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND DOCS requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['substr']);

    if (!('substr' in docs)) {
      assert.fail('expected substr in COMMAND DOCS output');
    }

    const substrDoc = docs.substr;

    assert.strictEqual(
      substrDoc.summary,
      'Returns a substring from a string value.',
    );
    assert.strictEqual(substrDoc.since, '1.0.0');
    assert.strictEqual(substrDoc.group, 'string');
    if (capabilities.isValkey && capabilities.atLeast(9, 0)) {
      assert.strictEqual(substrDoc.docFlags, undefined);
      assert.strictEqual(substrDoc.deprecatedSince, undefined);
      assert.strictEqual(substrDoc.replacedBy, undefined);
    } else {
      assert.deepStrictEqual(substrDoc.docFlags, ['deprecated']);
      assert.strictEqual(substrDoc.deprecatedSince, '2.0.0');
      assert.strictEqual(substrDoc.replacedBy, '`GETRANGE`');
    }
  });

  it('kills a client connection by id', async () => {
    const dedicated = await createClient();

    try {
      const id = await dedicated.clientId();
      const result = await client.clientKill(id);

      assert.strictEqual(result, 1);
    } finally {
      await closeClient(dedicated);
    }
  });

  it('returns 0 when unblocking a non-blocked client in all modes', async () => {
    const id = await client.clientId();

    assert.strictEqual(
      await client.clientUnblock(id),
      0,
      'CLIENT UNBLOCK without options must return 0 for a non-blocked client',
    );
    assert.strictEqual(
      await client.clientUnblock(id, { timeout: true }),
      0,
      'CLIENT UNBLOCK TIMEOUT must return 0 for a non-blocked client',
    );
    assert.strictEqual(
      await client.clientUnblock(id, { error: true }),
      0,
      'CLIENT UNBLOCK ERROR must return 0 for a non-blocked client',
    );
  });

  it('actually unblocks a blocked client with ERROR', async () => {
    const blocked = await createClient();

    try {
      const blockedId = await blocked.clientId();
      const blockKey = keyspace.key('unblock-target');

      const pending = blocked
        .blpop([blockKey], 0)
        .then(() => ({ rejected: false, error: undefined as unknown }))
        .catch((error: unknown) => ({ rejected: true, error }));

      await waitFor(
        async () =>
          (await client.clientUnblock(blockedId, { error: true })) === 1,
        { timeout: 2000, interval: 50, description: 'client becomes blocked' },
      );

      const settlement = await pending;

      assert.strictEqual(settlement.rejected, true);

      if (!(settlement.error instanceof Error)) {
        assert.fail('settlement.error must be an Error instance');
      }

      assert.strictEqual(
        settlement.error.message,
        `[BLPOP ${blockKey} 0] Unexpected reply: RespError: UNBLOCKED client unblocked via CLIENT UNBLOCK`,
      );
    } finally {
      await closeClient(blocked);
    }
  });

  it('toggles client caching mode', async () => {
    await assert.rejects(
      () => client.clientCaching('YES'),
      (error: Error) =>
        error.message ===
        '[CLIENT CACHING YES] Invalid reply: RespError: ERR CLIENT CACHING can be called only when the client is in tracking mode with OPTIN or OPTOUT mode enabled',
    );
  });

  it('enables client tracking with BCAST and prefixes', async (context) => {
    if (!capabilities.atLeast(6, 0)) {
      context.skip('CLIENT TRACKING requires Redis 6.0+');
      return;
    }

    const dedicated = await createClient();

    try {
      const result = await dedicated.clientTracking('ON', {
        bcast: true,
        prefixes: ['solidis:'],
        noloop: true,
      });

      assert.strictEqual(result, 'OK');
      assert.deepStrictEqual(await dedicated.clientTrackinginfo(), {
        flags: ['on', 'bcast', 'noloop'],
        redirect: 0,
        prefixes: ['solidis:'],
      });
      assert.strictEqual(await dedicated.clientTracking('OFF'), 'OK');
      assert.deepStrictEqual(await dedicated.clientTrackinginfo(), {
        flags: ['off'],
        redirect: -1,
        prefixes: [],
      });
    } finally {
      await closeClient(dedicated);
    }
  });

  it('enables client tracking with OPTIN mode', async (context) => {
    if (!capabilities.atLeast(6, 0)) {
      context.skip('CLIENT TRACKING requires Redis 6.0+');
      return;
    }

    const dedicated = await createClient();

    try {
      assert.strictEqual(
        await dedicated.clientTracking('ON', { optin: true }),
        'OK',
      );
      assert.deepStrictEqual(await dedicated.clientTrackinginfo(), {
        flags: ['on', 'optin'],
        redirect: 0,
        prefixes: [],
      });
      assert.strictEqual(await dedicated.clientTracking('OFF'), 'OK');
    } finally {
      await closeClient(dedicated);
    }
  });

  it('enables client tracking with OPTOUT mode', async (context) => {
    if (!capabilities.atLeast(6, 0)) {
      context.skip('CLIENT TRACKING requires Redis 6.0+');
      return;
    }

    const dedicated = await createClient();

    try {
      assert.strictEqual(
        await dedicated.clientTracking('ON', { optout: true }),
        'OK',
      );
      assert.deepStrictEqual(await dedicated.clientTrackinginfo(), {
        flags: ['on', 'optout'],
        redirect: 0,
        prefixes: [],
      });
      assert.strictEqual(await dedicated.clientTracking('OFF'), 'OK');
    } finally {
      await closeClient(dedicated);
    }
  });

  it('enables client tracking with REDIRECT', async (context) => {
    if (!capabilities.atLeast(6, 0)) {
      context.skip('CLIENT TRACKING requires Redis 6.0+');
      return;
    }

    const redirectTarget = await createClient();
    const trackingClient = await createClient();

    try {
      const targetId = await redirectTarget.clientId();

      assert.strictEqual(
        await trackingClient.clientTracking('ON', { redirect: targetId }),
        'OK',
      );
      assert.deepStrictEqual(await trackingClient.clientTrackinginfo(), {
        flags: ['on'],
        redirect: targetId,
        prefixes: [],
      });
      assert.strictEqual(await trackingClient.clientTracking('OFF'), 'OK');
    } finally {
      await closeClient(redirectTarget);
      await closeClient(trackingClient);
    }
  });

  it('reads client tracking info', async (context) => {
    if (!capabilities.atLeast(6, 2)) {
      context.skip('CLIENT TRACKINGINFO requires Redis 6.2+');
      return;
    }

    const info = await client.clientTrackinginfo();

    assert.deepStrictEqual(info.flags, ['off']);
    assert.strictEqual(info.redirect, -1);
    assert.deepStrictEqual(info.prefixes, []);
  });

  it('switches client reply mode', async () => {
    assert.strictEqual(await client.clientReply('ON'), 'OK');
  });

  it('constructs CLIENT REPLY OFF without sending', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/client.reply.ts'
    );

    assert.deepStrictEqual(createCommand('OFF'), ['CLIENT', 'REPLY', 'OFF']);
  });

  it('filters CLIENT LIST by ID', async () => {
    const myId = await client.clientId();
    const list = await client.clientList({ identifiers: [myId] });
    const clients = parseClientList(list);

    assert.strictEqual(clients.length, 1);
    assert.strictEqual(Number.parseInt(clients[0].id ?? '', 10), myId);
  });

  it('pauses clients with WRITE mode', async () => {
    assert.strictEqual(await client.clientPause(50, { mode: 'WRITE' }), 'OK');
    assert.strictEqual(await client.clientUnpause(), 'OK');
  });

  it('lists shard channels with pattern', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const channels = await client.pubsubShardchannels('nonexistent:*');

    assert.deepStrictEqual(channels, []);
  });

  it('constructs AUTH with single password argument', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/auth.ts'
    );

    const command = createCommand('mypassword');

    assert.deepStrictEqual(command, ['AUTH', 'mypassword']);
  });
});
