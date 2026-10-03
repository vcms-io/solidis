/** Publish/subscribe messaging: channels, patterns, shard pub/sub, and introspection. */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  RespPush,
  SolidisPubSub,
  SolidisPubSubError,
} from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
  waitFor,
} from '../utils/index.ts';

import type { SolidisData, StringOrBuffer } from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/client.ts';

describe('pubsub', () => {
  let subscriber: FeaturedClient;
  let publisher: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('pubsub');

  beforeEach(async () => {
    subscriber = await createClient();
    publisher = await createClient();
    atLeast7 = (await detectServerCapabilities(publisher)).atLeast(7, 0);
  });

  afterEach(async () => {
    await closeClient(subscriber);
    await closeClient(publisher);
  });

  it('delivers a message to a channel subscriber', async () => {
    const channel = keyspace.key('news');
    const received: { channel: string; message: StringOrBuffer }[] = [];

    subscriber.on('message', (incomingChannel, message) => {
      received.push({ channel: incomingChannel, message });
    });

    await subscriber.subscribe(channel);

    await waitFor(
      async () =>
        Object.keys(await publisher.pubsubNumsub([channel]))[0] === channel &&
        (await publisher.pubsubNumsub([channel]))[channel] === 1,
      { description: 'subscriber registered' },
    );

    assert.strictEqual(await publisher.publish(channel, 'hello'), 1);

    await waitFor(() => received.length === 1, {
      description: 'message delivered',
    });

    assert.strictEqual(received[0].channel, channel);
    assert.deepStrictEqual(received[0].message, Buffer.from('hello'));
  });

  it('preserves binary message payloads', async () => {
    const channel = keyspace.key('binary');
    const payload = Buffer.from([0, 255, 1, 254, 2, 253]);
    const received: StringOrBuffer[] = [];

    subscriber.on('message', (_incomingChannel, message) => {
      received.push(message);
    });

    await subscriber.subscribe(channel);

    await waitFor(
      async () =>
        Object.keys(await publisher.pubsubNumsub([channel]))[0] === channel &&
        (await publisher.pubsubNumsub([channel]))[channel] === 1,
      { description: 'subscriber registered' },
    );

    await publisher.send([['PUBLISH', channel, payload]]);

    await waitFor(() => received.length === 1, {
      description: 'binary message delivered',
    });

    assert.deepStrictEqual(received[0], payload);
  });

  it('fans out to multiple channels', async () => {
    const first = keyspace.key('multi', 'first');
    const second = keyspace.key('multi', 'second');
    const received = new Map<string, string>();

    subscriber.on('message', (channel, message) => {
      received.set(channel, `${message}`);
    });

    await subscriber.subscribe(first, second);

    await waitFor(
      async () =>
        (await publisher.pubsubChannels(`${keyspace.namespace}:multi:*`))
          .length === 2,
    );

    assert.deepStrictEqual(
      [
        ...(await publisher.pubsubChannels(`${keyspace.namespace}:multi:*`)),
      ].sort(),
      [first, second].sort(),
    );

    await publisher.publish(first, 'one');
    await publisher.publish(second, 'two');

    await waitFor(() => received.size === 2);

    assert.strictEqual(received.get(first), 'one');
    assert.strictEqual(received.get(second), 'two');
  });

  it('matches pattern subscriptions with pmessage', async () => {
    const pattern = `${keyspace.namespace}:sensor:*`;
    const channel = keyspace.key('sensor', 'temperature');
    const received: { pattern: string; channel: string; message: string }[] =
      [];

    subscriber.on('pmessage', (matchedPattern, matchedChannel, message) => {
      received.push({
        pattern: matchedPattern,
        channel: matchedChannel,
        message: `${message}`,
      });
    });

    await subscriber.psubscribe(pattern);

    await waitFor(async () => (await publisher.pubsubNumpat()) === 1);

    await publisher.publish(channel, '21.5');

    await waitFor(() => received.length === 1);

    assert.strictEqual(received[0].pattern, pattern);
    assert.strictEqual(received[0].channel, channel);
    assert.strictEqual(received[0].message, '21.5');
  });

  it('emits subscribe and unsubscribe bookkeeping events', async () => {
    const channel = keyspace.key('bookkeeping');
    const events: { type: string; channel: string; count: number }[] = [];

    subscriber.on('subscribe', (subscribedChannel, count) => {
      events.push({ type: 'subscribe', channel: subscribedChannel, count });
    });
    subscriber.on('unsubscribe', (unsubscribedChannel, count) => {
      events.push({
        type: 'unsubscribe',
        channel: unsubscribedChannel,
        count,
      });
    });

    await subscriber.subscribe(channel);

    await waitFor(() => events.length === 1);

    assert.deepStrictEqual(events[0], {
      type: 'subscribe',
      channel,
      count: 1,
    });

    await subscriber.unsubscribe(channel);

    await waitFor(() => events.length === 2);

    assert.deepStrictEqual(events[1], {
      type: 'unsubscribe',
      channel,
      count: 0,
    });
  });

  it('does not deliver after unsubscribe', async () => {
    const channel = keyspace.key('stop');
    let messageCount = 0;

    subscriber.on('message', () => {
      messageCount += 1;
    });

    await subscriber.subscribe(channel);
    await subscriber.unsubscribe(channel);

    await waitFor(
      async () => (await publisher.pubsubChannels(channel)).length === 0,
    );

    await publisher.publish(channel, 'ignored');

    for (let tick = 0; tick < 20; tick += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    assert.strictEqual(messageCount, 0);
  });

  it('delivers shard messages via ssubscribe/spublish', async (context) => {
    /** Sharded pub/sub (SSUBSCRIBE/SPUBLISH) was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('sharded pub/sub requires Redis 7.0+');
      return;
    }

    const channel = keyspace.key('shard');
    const received: string[] = [];

    subscriber.on('smessage', (_channel, message) => {
      received.push(`${message}`);
    });

    await subscriber.ssubscribe(channel);

    await waitFor(async () => {
      const channels = await publisher.pubsubShardchannels();
      return channels.length === 1 && channels[0] === channel;
    });

    assert.strictEqual(await publisher.spublish(channel, 'shard-message'), 1);

    await waitFor(() => received.length === 1);

    assert.strictEqual(received[0], 'shard-message');
  });

  it('stops pattern delivery after PUNSUBSCRIBE', async () => {
    const pattern = `${keyspace.namespace}:punsubscribe:*`;
    const channel = keyspace.key('punsubscribe', 'test');
    let messageCount = 0;

    subscriber.on('pmessage', () => {
      messageCount += 1;
    });

    await subscriber.psubscribe(pattern);

    await waitFor(async () => (await publisher.pubsubNumpat()) === 1);

    await subscriber.punsubscribe(pattern);

    await waitFor(async () => (await publisher.pubsubNumpat()) === 0);

    await publisher.publish(channel, 'ignored');

    for (let tick = 0; tick < 20; tick += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    assert.strictEqual(messageCount, 0);
  });

  it('stops shard delivery after SUNSUBSCRIBE', async (context) => {
    if (!atLeast7) {
      context.skip('sharded pub/sub requires Redis 7.0+');
      return;
    }

    const channel = keyspace.key('sunsubscribe');
    let messageCount = 0;

    subscriber.on('smessage', () => {
      messageCount += 1;
    });

    await subscriber.ssubscribe(channel);

    await waitFor(async () => {
      const channels = await publisher.pubsubShardchannels();
      return channels.length === 1 && channels[0] === channel;
    });

    await subscriber.sunsubscribe(channel);

    await waitFor(async () => {
      const channels = await publisher.pubsubShardchannels();
      return channels.length === 0;
    });

    await publisher.spublish(channel, 'ignored');

    for (let tick = 0; tick < 20; tick += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    assert.strictEqual(messageCount, 0);
  });

  it('reports shard subscription counts with PUBSUB SHARDNUMSUB', async (context) => {
    if (!atLeast7) {
      context.skip('sharded pub/sub requires Redis 7.0+');
      return;
    }

    const channel = keyspace.key('shardnumsub');

    await subscriber.ssubscribe(channel);

    await waitFor(async () => {
      const channels = await publisher.pubsubShardchannels();
      return channels.length === 1 && channels[0] === channel;
    });

    const counts = await publisher.pubsubShardnumsub([channel]);

    assert.strictEqual(counts[channel], 1);
  });

  it('handles PSUBSCRIBE and PUNSUBSCRIBE for pattern channels', async () => {
    const messages: string[] = [];

    subscriber.on('pmessage', (_pattern, _channel, message) => {
      messages.push(String(message));
    });

    await subscriber.psubscribe(keyspace.key('pattern:*'));

    await publisher.publish(keyspace.key('pattern:foo'), 'pattern-msg');

    await waitFor(() => messages.length === 1, { timeout: 1000 });

    assert.deepStrictEqual(messages, ['pattern-msg']);

    await subscriber.punsubscribe(keyspace.key('pattern:*'));
  });

  it('unsubscribes from every channel when called without arguments', async () => {
    const channels = [
      keyspace.key('all', 'first'),
      keyspace.key('all', 'second'),
      keyspace.key('all', 'third'),
    ];
    const unsubscribed: [string, number][] = [];
    const key = keyspace.key('all', 'key');

    subscriber.on('unsubscribe', (channel, count) => {
      unsubscribed.push([channel, count]);
    });

    await subscriber.subscribe(...channels);
    await subscriber.unsubscribe();

    assert.deepStrictEqual(
      unsubscribed.map(([channel]) => channel).sort(),
      [...channels].sort(),
    );
    assert.deepStrictEqual(
      unsubscribed.map(([, count]) => count),
      [2, 1, 0],
    );
    assert.strictEqual(await subscriber.set(key, 'normal-mode'), 'OK');
    assert.strictEqual(await subscriber.get(key), 'normal-mode');
  });

  it('resolves an argument-less unsubscribe when nothing is subscribed', async () => {
    const events: unknown[] = [];

    subscriber.on('unsubscribe', (...parameters) => {
      events.push(parameters);
    });

    await subscriber.unsubscribe();
    await subscriber.punsubscribe();

    assert.deepStrictEqual(events, []);
    assert.strictEqual(await subscriber.echo('aligned'), 'aligned');
  });

  it('keeps patterns subscribed when only channels are unsubscribed', async () => {
    const channel = keyspace.key('mixed', 'channel');
    const pattern = `${keyspace.namespace}:mixed:pattern:*`;
    const patternChannel = keyspace.key('mixed', 'pattern', 'hit');
    const received: string[] = [];

    subscriber.on('pmessage', (_pattern, _channel, message) => {
      received.push(`${message}`);
    });

    await subscriber.subscribe(channel);
    await subscriber.psubscribe(pattern);
    await subscriber.unsubscribe();

    assert.strictEqual(await publisher.publish(channel, 'dropped'), 0);
    assert.strictEqual(await publisher.publish(patternChannel, 'kept'), 1);

    await waitFor(() => received.length === 1);

    assert.deepStrictEqual(received, ['kept']);
  });

  it('survives a message listener that throws', async () => {
    const channel = keyspace.key('throwing');
    const received: string[] = [];
    const errors: unknown[] = [];
    const failure = new Error('listener failure');

    subscriber.on('error', (error) => {
      errors.push(error);
    });
    subscriber.on('message', (_channel, message) => {
      received.push(`${message}`);

      if (received.length === 1) {
        throw failure;
      }
    });

    await subscriber.subscribe(channel);
    await publisher.publish(channel, 'first');
    await publisher.publish(channel, 'second');

    await waitFor(() => received.length === 2);

    assert.deepStrictEqual(received, ['first', 'second']);

    const [error] = errors;

    assert.strictEqual(errors.length, 1);
    assert.ok(error instanceof SolidisPubSubError);
    assert.strictEqual(error.message, "A 'message' listener threw");
    assert.strictEqual(error.cause, failure);
  });

  it('delivers every message published during a burst in order', async () => {
    const channel = keyspace.key('burst');
    const total = 500;
    const received: string[] = [];

    subscriber.on('message', (_channel, message) => {
      received.push(`${message}`);
    });

    await subscriber.subscribe(channel);

    await publisher.send(
      Array.from({ length: total }, (_, index) => [
        'PUBLISH',
        channel,
        `${index}`,
      ]),
    );

    await waitFor(() => received.length === total, { timeout: 5000 });

    assert.deepStrictEqual(
      received,
      Array.from({ length: total }, (_, index) => `${index}`),
    );
  });

  describe('SolidisPubSub', () => {
    function createPubSub() {
      const events: unknown[][] = [];
      const pubSub = new SolidisPubSub((event, ...parameters) => {
        events.push([event, ...parameters]);

        return true;
      });

      return { events, pubSub };
    }

    function getErrorMessages(events: unknown[][]) {
      return events
        .filter(([event]) => event === 'error')
        .map(([, error]) => {
          if (!(error instanceof SolidisPubSubError)) {
            assert.fail('expected a SolidisPubSubError');
          }

          return error.message;
        });
    }

    for (const eventName of ['message', 'smessage'] as const) {
      it(`dispatches ${eventName} events with a text channel and raw payload`, () => {
        const { events, pubSub } = createPubSub();

        pubSub.dispatchMessage(eventName, [
          Buffer.from(eventName),
          Buffer.from('ch1'),
          Buffer.from('hello'),
        ]);
        pubSub.dispatchMessage(eventName, [eventName, 'ch2', 'plain']);

        assert.deepStrictEqual(events, [
          [eventName, 'ch1', Buffer.from('hello')],
          [eventName, 'ch2', 'plain'],
        ]);
      });
    }

    it('dispatches pmessage events with pattern, channel and payload', () => {
      const { events, pubSub } = createPubSub();

      pubSub.dispatchMessage('pmessage', [
        Buffer.from('pmessage'),
        Buffer.from('ch:*'),
        Buffer.from('ch:1'),
        Buffer.from('data'),
      ]);

      assert.deepStrictEqual(events, [
        ['pmessage', 'ch:*', 'ch:1', Buffer.from('data')],
      ]);
    });

    const malformedMessages: [
      'message' | 'smessage' | 'pmessage',
      SolidisData[],
    ][] = [
      ['message', ['message', null, null]],
      ['message', ['message', 'channel', 42]],
      ['message', ['message', 7, 'payload']],
      ['smessage', ['smessage', 'channel', ['nested']]],
      ['pmessage', ['pmessage', null, null, null]],
      ['pmessage', ['pmessage', 'pattern', null, 'payload']],
      ['pmessage', ['pmessage', 'pattern', 'channel', null]],
    ];

    for (const [eventName, reply] of malformedMessages) {
      it(`reports a malformed ${eventName} ${JSON.stringify(reply)} without emitting it`, () => {
        const { events, pubSub } = createPubSub();

        pubSub.dispatchMessage(eventName, reply);

        assert.strictEqual(events.length, 1);
        assert.deepStrictEqual(getErrorMessages(events), [
          `Malformed '${eventName}' event`,
        ]);
      });
    }

    const subscriptionPairs = [
      ['subscribe', 'unsubscribe'],
      ['ssubscribe', 'sunsubscribe'],
      ['psubscribe', 'punsubscribe'],
    ] as const;

    for (const [subscribeName, unsubscribeName] of subscriptionPairs) {
      it(`tracks ${subscribeName}/${unsubscribeName} in a set of its own`, () => {
        const { events, pubSub } = createPubSub();

        pubSub.dispatchSubscriptionChange(subscribeName, [
          Buffer.from(subscribeName),
          Buffer.from('target'),
          1,
        ]);

        assert.deepStrictEqual(pubSub.getSubscriptions(subscribeName), [
          Buffer.from('target'),
        ]);
        assert.deepStrictEqual(
          pubSub.getSubscriptions(unsubscribeName),
          pubSub.getSubscriptions(subscribeName),
        );

        for (const [otherName] of subscriptionPairs) {
          if (otherName !== subscribeName) {
            assert.strictEqual(pubSub.getSubscriptions(otherName).length, 0);
          }
        }

        assert.strictEqual(pubSub.hasActiveSubscriptions, true);

        pubSub.dispatchSubscriptionChange(unsubscribeName, [
          unsubscribeName,
          'target',
          0,
        ]);

        assert.strictEqual(pubSub.getSubscriptions(subscribeName).length, 0);
        assert.strictEqual(pubSub.hasActiveSubscriptions, false);
        assert.deepStrictEqual(events, [
          [subscribeName, 'target', 1],
          [unsubscribeName, 'target', 0],
        ]);
      });
    }

    it('reports a subscription change with a non-numeric count without tracking it', () => {
      const { events, pubSub } = createPubSub();

      pubSub.dispatchSubscriptionChange('subscribe', [
        Buffer.from('subscribe'),
        Buffer.from('ch'),
        Buffer.from('nan'),
      ]);

      assert.deepStrictEqual(getErrorMessages(events), [
        "Malformed 'subscribe' event",
      ]);
      assert.strictEqual(pubSub.hasActiveSubscriptions, false);
    });

    it('silently accepts an unsubscribe confirmation without a channel', () => {
      const { events, pubSub } = createPubSub();

      pubSub.dispatchSubscriptionChange('unsubscribe', [
        'unsubscribe',
        null,
        0,
      ]);

      assert.deepStrictEqual(events, []);
    });

    it('clears one kind of subscription or all of them', () => {
      const { pubSub } = createPubSub();

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'a', 1]);
      pubSub.dispatchSubscriptionChange('psubscribe', ['psubscribe', 'p:*', 2]);
      pubSub.dispatchSubscriptionChange('ssubscribe', ['ssubscribe', 's', 1]);
      pubSub.clearSubscriptions('punsubscribe');

      assert.strictEqual(pubSub.getSubscriptions('psubscribe').length, 0);
      assert.strictEqual(pubSub.getSubscriptions('subscribe').length, 1);
      assert.strictEqual(pubSub.getSubscriptions('ssubscribe').length, 1);

      pubSub.clear();

      assert.strictEqual(pubSub.hasActiveSubscriptions, false);
    });

    it('keeps the exact bytes of every subscribed channel', () => {
      const { events, pubSub } = createPubSub();
      const binary = Buffer.from([0x76, 0x3a, 0xff]);
      const lookalike = Buffer.from([0x76, 0x3a, 0xfe]);

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', binary, 1]);
      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'é', 2]);
      pubSub.dispatchSubscriptionChange('subscribe', [
        'subscribe',
        lookalike,
        3,
      ]);

      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), [
        binary,
        Buffer.from('é'),
        lookalike,
      ]);
      assert.notStrictEqual(pubSub.getSubscriptions('subscribe')[0], binary);

      pubSub.dispatchSubscriptionChange('unsubscribe', [
        'unsubscribe',
        Buffer.from(binary),
        2,
      ]);

      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), [
        Buffer.from('é'),
        lookalike,
      ]);
      assert.deepStrictEqual(events.at(-1), [
        'unsubscribe',
        binary.toString(),
        2,
      ]);
    });

    it('emits RESP2 client-side caching invalidations as pushes', () => {
      const { events, pubSub } = createPubSub();
      const keys = [Buffer.from('user:1'), Buffer.from('user:2')];

      pubSub.dispatchMessage('message', [
        Buffer.from('message'),
        Buffer.from('__redis__:invalidate'),
        keys,
      ]);
      pubSub.dispatchMessage('message', [
        Buffer.from('message'),
        Buffer.from('__redis__:invalidate'),
        null,
      ]);
      pubSub.dispatchMessage('pmessage', [
        Buffer.from('pmessage'),
        Buffer.from('__redis__:*'),
        Buffer.from('__redis__:invalidate'),
        keys,
      ]);
      pubSub.dispatchMessage('message', [
        Buffer.from('message'),
        Buffer.from('__redis__:invalidate'),
        Buffer.from('text payload'),
      ]);

      assert.strictEqual(events.length, 4);

      for (const [index, payload] of [keys, null, keys].entries()) {
        const [event, push] = events[index];

        assert.strictEqual(event, 'push');
        assert.ok(push instanceof RespPush);
        assert.deepStrictEqual([...push], [Buffer.from('invalidate'), payload]);
      }

      assert.deepStrictEqual(events[3], [
        'message',
        '__redis__:invalidate',
        Buffer.from('text payload'),
      ]);
    });

    it('turns a throwing listener into a SolidisPubSubError carrying the cause', () => {
      const errors: unknown[] = [];
      const failure = new Error('listener failure');
      const pubSub = new SolidisPubSub((event, ...parameters) => {
        if (event === 'error') {
          errors.push(parameters[0]);

          return true;
        }

        throw failure;
      });

      pubSub.dispatchMessage('message', ['message', 'ch', 'payload']);
      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'ch', 1]);
      pubSub.dispatchMessage('message', [
        'message',
        '__redis__:invalidate',
        null,
      ]);

      assert.strictEqual(errors.length, 3);

      for (const [index, eventName] of [
        'message',
        'subscribe',
        'push',
      ].entries()) {
        const error = errors[index];

        if (!(error instanceof SolidisPubSubError)) {
          assert.fail('expected a SolidisPubSubError');
        }

        assert.strictEqual(error.message, `A '${eventName}' listener threw`);
        assert.strictEqual(error.cause, failure);
      }

      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), [
        Buffer.from('ch'),
      ]);
    });
  });
});
