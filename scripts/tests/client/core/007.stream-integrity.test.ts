/** Replies stay paired with their requests while pushes, messages and look-alike data flow. */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import { RespPush } from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  MockRedisServer,
  mockClientOptions,
  range,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('stream-integrity', () => {
  const keyspace = createKeyspace('stream-integrity');
  const clients: FeaturedClient[] = [];
  const servers: MockRedisServer[] = [];

  after(async () => {
    await Promise.all(clients.map((client) => closeClient(client)));
    await Promise.all(servers.map((server) => server.close()));
  });

  async function track(client: Promise<FeaturedClient>) {
    const created = await client;

    clients.push(created);

    return created;
  }

  async function startMockServer() {
    const server = new MockRedisServer();

    servers.push(server);

    await server.listen();

    return server;
  }

  it('delivers RESP3 invalidation pushes without disturbing pending replies', async () => {
    const tracked = await track(createClient({ protocol: 'RESP3' }));
    const writer = await track(createClient());
    const key = keyspace.key('tracked');
    const pushes: RespPush[] = [];
    const errors: Error[] = [];

    tracked.on('push', (push) => pushes.push(push));
    tracked.on('error', (error) => errors.push(error));

    await writer.set(key, 'first');

    assert.deepStrictEqual(await tracked.send([['CLIENT', 'TRACKING', 'ON']]), [
      ['OK'],
    ]);
    assert.strictEqual(await tracked.get(key), 'first');

    await writer.set(key, 'second');

    const values = await Promise.all(range(100).map(() => tracked.get(key)));

    assert.deepStrictEqual(
      values,
      range(100).map(() => 'second'),
    );

    await waitFor(() => pushes.length === 1, {
      description: 'invalidation push',
    });

    assert.deepStrictEqual(pushes, [
      RespPush.from([Buffer.from('invalidate'), [Buffer.from(key)]]),
    ]);
    assert.deepStrictEqual(errors, []);
  });

  it('lets a RESP3 subscriber run commands while messages stream in', async () => {
    const subscriber = await track(createClient({ protocol: 'RESP3' }));
    const publisher = await track(createClient());
    const channel = keyspace.key('resp3', 'channel');
    const counter = keyspace.key('resp3', 'counter');
    const total = 300;
    const received: string[] = [];

    subscriber.on('message', (_channel, message) => {
      received.push(`${message}`);
    });

    await subscriber.subscribe(channel);

    const publishing = publisher.send(
      range(total).map((index) => ['PUBLISH', channel, `${index}`]),
    );
    const increments = await Promise.all(
      range(total).map(() => subscriber.incr(counter)),
    );

    await publishing;

    assert.deepStrictEqual(
      increments,
      range(total).map((index) => index + 1),
    );

    await waitFor(() => received.length === total, { timeout: 5000 });

    assert.deepStrictEqual(
      received,
      range(total).map((index) => `${index}`),
    );
  });

  it('returns RESP2 list data shaped like pub/sub frames as plain data', async () => {
    const client = await track(createClient({ protocol: 'RESP2' }));
    const key = keyspace.key('lookalike');
    const channel = keyspace.key('lookalike', 'channel');
    const events: unknown[] = [];

    for (const eventName of ['message', 'subscribe'] as const) {
      client.on(eventName, (...parameters: unknown[]) => {
        events.push([eventName, ...parameters]);
      });
    }

    await client.rpush(key, 'message', 'channel', 'payload');

    assert.deepStrictEqual(await client.lrange(key, 0, -1), [
      'message',
      'channel',
      'payload',
    ]);

    await client.del(key);
    await client.rpush(key, 'subscribe', channel, '1');

    const [lookalike, confirmation] = await client.send([
      ['LRANGE', key, '0', '-1'],
      ['SUBSCRIBE', channel],
    ]);

    assert.deepStrictEqual(lookalike, [
      [Buffer.from('subscribe'), Buffer.from(channel), Buffer.from('1')],
    ]);
    assert.deepStrictEqual(confirmation, [
      [Buffer.from('subscribe'), Buffer.from(channel), 1],
    ]);
    assert.deepStrictEqual(events, [['subscribe', channel, 1]]);

    await client.unsubscribe();

    assert.strictEqual(await client.echo('aligned'), 'aligned');
  });

  it('emits unsolicited pushes and keeps replies aligned', async () => {
    const server = await startMockServer();
    const push = '>2\r\n$10\r\ninvalidate\r\n_\r\n';

    server.onData((socket) => {
      socket.write(`${push}+PONG\r\n`);
    });

    const client = new SolidisFeaturedClient(mockClientOptions(server.port));
    const pushes: RespPush[] = [];
    const errors: Error[] = [];

    clients.push(client);
    client.on('push', (reply) => pushes.push(reply));
    client.on('error', (error) => errors.push(error));

    await client.connect();

    assert.strictEqual(await client.ping(), 'PONG');
    assert.strictEqual(pushes.length, 1);

    server.send(push);

    await waitFor(() => pushes.length === 2);

    assert.strictEqual(await client.ping(), 'PONG');
    assert.deepStrictEqual(
      pushes,
      range(3).map(() => RespPush.from([Buffer.from('invalidate'), null])),
    );
    assert.deepStrictEqual(errors, []);
  });

  it('reports a reply that arrives with nothing pending', async () => {
    const server = await startMockServer();

    server.onData((socket) => {
      socket.write('+PONG\r\n');
    });

    const client = new SolidisFeaturedClient(mockClientOptions(server.port));
    const errors: Error[] = [];

    clients.push(client);
    client.on('error', (error) => errors.push(error));

    await client.connect();

    server.send('+ORPHAN\r\n');

    await waitFor(() => errors.length === 1);

    assert.strictEqual(
      errors[0].message,
      'Received reply with no pending request',
    );
    assert.strictEqual(await client.ping(), 'PONG');
  });
});
