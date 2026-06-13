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
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/index.ts';

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

    assert.strictEqual(typeof info, 'string');
    assert.ok(info.includes('id='));
    assert.ok(info.includes('fd='));
  });

  it('lists connected clients with CLIENT LIST', async () => {
    const list = await client.clientList();

    assert.strictEqual(typeof list, 'string');
    assert.ok(list.includes('id='));
  });

  it('filters CLIENT LIST by type', async () => {
    const list = await client.clientList({ type: 'NORMAL' });

    assert.strictEqual(typeof list, 'string');
    assert.ok(list.length > 0);
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

    assert.strictEqual(typeof redirect, 'number');
  });

  it('reports total command count with COMMAND COUNT', async () => {
    const count = await client.commandCount();

    assert.strictEqual(typeof count, 'number');
    assert.ok(count > 100);
  });

  it('lists commands with COMMAND LIST', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND LIST requires Redis 7.0+');
      return;
    }

    const commands = await client.commandList();

    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 100);
    assert.ok(commands.includes('get'));
    assert.ok(commands.includes('set'));
  });

  it('filters COMMAND LIST by pattern', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND LIST requires Redis 7.0+');
      return;
    }

    const commands = await client.commandList({ pattern: 'z*' });

    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
    assert.ok(commands.every((command) => command.startsWith('z')));
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

    assert.ok(Array.isArray(commands));
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

    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
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

    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  it('retrieves command documentation with COMMAND DOCS', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND DOCS requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['get']);

    assert.ok(docs !== null && typeof docs === 'object');
    assert.ok('get' in docs);
  });

  it('parses COMMAND DOCS with history and arguments', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND DOCS requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['set']);

    assert.ok(docs !== null && typeof docs === 'object');
    assert.ok('set' in docs);

    const setDoc = docs.set;

    assert.strictEqual(typeof setDoc.summary, 'string');
    assert.strictEqual(typeof setDoc.since, 'string');
    assert.strictEqual(typeof setDoc.group, 'string');
    assert.strictEqual(typeof setDoc.complexity, 'string');

    if (setDoc.history) {
      assert.ok(Array.isArray(setDoc.history));
      assert.ok(setDoc.history.length > 0);
      assert.ok(setDoc.history[0].includes(':'));
    }

    if (setDoc.arguments) {
      assert.ok(Array.isArray(setDoc.arguments));
      assert.ok(setDoc.arguments.length > 0);
      assert.strictEqual(typeof setDoc.arguments[0].name, 'string');
      assert.strictEqual(typeof setDoc.arguments[0].type, 'string');
    }
  });

  it('parses COMMAND DOCS for a deprecated command', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('COMMAND DOCS requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['substr']);

    assert.ok(docs !== null && typeof docs === 'object');
    assert.ok('substr' in docs);

    const substrDoc = docs.substr;

    if (substrDoc.docFlags) {
      assert.ok(Array.isArray(substrDoc.docFlags));
      assert.ok(substrDoc.docFlags.includes('deprecated'));
    }

    if (substrDoc.deprecatedSince) {
      assert.strictEqual(typeof substrDoc.deprecatedSince, 'string');
    }

    if (substrDoc.replacedBy) {
      assert.strictEqual(typeof substrDoc.replacedBy, 'string');
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

  it('unblocks a client by id', async () => {
    const id = await client.clientId();
    /** The client is not blocked, so UNBLOCK reports 0 (nothing unblocked). */
    assert.strictEqual(await client.clientUnblock(id), 0);
  });

  it('unblocks a client with TIMEOUT option', async () => {
    const id = await client.clientId();
    assert.strictEqual(await client.clientUnblock(id, { timeout: true }), 0);
  });

  it('unblocks a client with ERROR option', async () => {
    const id = await client.clientId();
    assert.strictEqual(await client.clientUnblock(id, { error: true }), 0);
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

      /** UNBLOCK ... ERROR forces the blocked BLPOP to reject. */
      assert.strictEqual(settlement.rejected, true);
      assert.ok(settlement.error instanceof Error);
    } finally {
      await closeClient(blocked);
    }
  });

  it('toggles client caching mode', async () => {
    /** CLIENT CACHING is only valid in OPTIN/OPTOUT tracking mode. */
    await assert.rejects(
      () => client.clientCaching('YES'),
      (error: Error) => /tracking mode|OPTIN|OPTOUT/i.test(error.message),
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
      assert.strictEqual(await dedicated.clientTracking('OFF'), 'OK');
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

    assert.ok(Array.isArray(info.flags));
    assert.strictEqual(typeof info.redirect, 'number');
    assert.ok(Array.isArray(info.prefixes));
  });

  it('switches client reply mode', async () => {
    /** CLIENT REPLY ON synchronously acknowledges with OK. */
    assert.strictEqual(await client.clientReply('ON'), 'OK');
  });

  it('filters CLIENT LIST by ID', async () => {
    const myId = await client.clientId();
    const list = await client.clientList({ identifiers: [myId] });

    assert.strictEqual(typeof list, 'string');
    assert.ok(list.includes(`id=${myId}`));
  });

  it('pauses clients with WRITE mode', async () => {
    assert.strictEqual(await client.clientPause(50, { mode: 'WRITE' }), 'OK');
    await client.clientUnpause();
  });

  it('lists shard channels with pattern', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const channels = await client.pubsubShardchannels('nonexistent:*');

    assert.ok(Array.isArray(channels));
  });

  it('constructs AUTH with single password argument', async () => {
    const { createCommand } = await import('../../../sources/command/auth.ts');

    const command = createCommand('mypassword');

    assert.deepStrictEqual(command, ['AUTH', 'mypassword']);
  });
});
