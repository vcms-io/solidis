/** Publish/subscribe messaging: channels, patterns, shard pub/sub, and introspection. */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  detectServerCapabilities,
  waitFor,
} from '../utils/index.ts';

import type { StringOrBuffer } from '../../../sources/index.ts';
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
    assert.strictEqual(`${received[0].message}`, 'hello');
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
    await delay(200);

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
    await delay(200);

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
    await delay(200);

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

  it('dispatches message events via SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const events: unknown[] = [];

    const emit = (event: string, ...parameters: unknown[]) => {
      events.push([event, ...parameters]);
      return true;
    };

    pubsub.dispatchPubSubEvent(
      [Buffer.from('message'), Buffer.from('ch1'), Buffer.from('hello')],
      emit,
    );

    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(events[0], ['message', 'ch1', Buffer.from('hello')]);
  });

  it('dispatches pmessage events via SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const events: unknown[] = [];

    const emit = (event: string, ...parameters: unknown[]) => {
      events.push([event, ...parameters]);
      return true;
    };

    pubsub.dispatchPubSubEvent(
      [
        Buffer.from('pmessage'),
        Buffer.from('ch:*'),
        Buffer.from('ch:1'),
        Buffer.from('data'),
      ],
      emit,
    );

    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(events[0], [
      'pmessage',
      'ch:*',
      'ch:1',
      Buffer.from('data'),
    ]);
  });

  it('tracks subscribe/unsubscribe state in SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const emit = () => true;

    pubsub.dispatchPubSubEvent(
      [Buffer.from('subscribe'), Buffer.from('news'), 1],
      emit,
    );

    assert.strictEqual(pubsub.subscribedChannels.has('news'), true);

    pubsub.dispatchPubSubEvent(
      [Buffer.from('unsubscribe'), Buffer.from('news'), 0],
      emit,
    );

    assert.strictEqual(pubsub.subscribedChannels.has('news'), false);
  });

  it('tracks ssubscribe/sunsubscribe state in SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const emit = () => true;

    pubsub.dispatchPubSubEvent(
      [Buffer.from('ssubscribe'), Buffer.from('shard-ch'), 1],
      emit,
    );

    assert.strictEqual(pubsub.subscribedShardChannels.has('shard-ch'), true);

    pubsub.dispatchPubSubEvent(
      [Buffer.from('sunsubscribe'), Buffer.from('shard-ch'), 0],
      emit,
    );

    assert.strictEqual(pubsub.subscribedShardChannels.has('shard-ch'), false);
  });

  it('tracks psubscribe/punsubscribe state in SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const emit = () => true;

    pubsub.dispatchPubSubEvent(
      [Buffer.from('psubscribe'), Buffer.from('user:*'), 1],
      emit,
    );

    assert.strictEqual(pubsub.subscribedPatterns.has('user:*'), true);

    pubsub.dispatchPubSubEvent(
      [Buffer.from('punsubscribe'), Buffer.from('user:*'), 0],
      emit,
    );

    assert.strictEqual(pubsub.subscribedPatterns.has('user:*'), false);
  });

  it('reports hasActiveSubscriptions correctly in SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();

    assert.strictEqual(pubsub.hasActiveSubscriptions, false);

    pubsub.dispatchPubSubEvent(
      [Buffer.from('subscribe'), Buffer.from('test'), 1],
      () => true,
    );

    assert.strictEqual(pubsub.hasActiveSubscriptions, true);
  });

  it('emits error on invalid message type in SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const errors: unknown[] = [];

    const emit = (event: string, ...parameters: unknown[]) => {
      if (event === 'error') {
        errors.push(parameters[0]);
      }
      return true;
    };

    pubsub.dispatchPubSubEvent([Buffer.from('message'), null, null], emit);

    assert.strictEqual(errors.length, 1);

    if (!(errors[0] instanceof Error)) {
      assert.fail('expected an Error instance for message:type');
    }

    assert.strictEqual(errors[0].message, 'message:type');
  });

  it('emits error on unknown subscription event in SolidisPubSub', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const errors: unknown[] = [];

    const emit = (event: string, ...parameters: unknown[]) => {
      if (event === 'error') {
        errors.push(parameters[0]);
      }
      return true;
    };

    pubsub.dispatchPubSubEvent(
      [Buffer.from('unknownevent'), Buffer.from('ch'), 1],
      emit,
    );

    assert.strictEqual(errors.length, 1);

    if (!(errors[0] instanceof Error)) {
      assert.fail('expected an Error instance for unknownevent:event');
    }

    assert.strictEqual(errors[0].message, 'unknownevent:event');
  });

  it('emits error on malformed subscription (non-number count)', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const errors: unknown[] = [];

    const emit = (event: string, ...parameters: unknown[]) => {
      if (event === 'error') {
        errors.push(parameters[0]);
      }
      return true;
    };

    pubsub.dispatchPubSubEvent(
      [Buffer.from('subscribe'), Buffer.from('ch'), Buffer.from('nan')],
      emit,
    );

    assert.strictEqual(errors.length, 1);

    if (!(errors[0] instanceof Error)) {
      assert.fail('expected an Error instance for subscribe:type');
    }

    assert.strictEqual(errors[0].message, 'subscribe:type');
  });

  it('emits error on pmessage with invalid types', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const errors: unknown[] = [];

    const emit = (event: string, ...parameters: unknown[]) => {
      if (event === 'error') {
        errors.push(parameters[0]);
      }
      return true;
    };

    pubsub.dispatchPubSubEvent(
      [Buffer.from('pmessage'), null, null, null],
      emit,
    );

    assert.strictEqual(errors.length, 1);

    if (!(errors[0] instanceof Error)) {
      assert.fail('expected an Error instance for pmessage:type');
    }

    assert.strictEqual(errors[0].message, 'pmessage:type');
  });

  it('does not allow external mutation of subscribedChannels to corrupt state', async () => {
    const { SolidisPubSub } = await import(
      '../../../sources/modules/pubsub.ts'
    );

    const pubsub = new SolidisPubSub();
    const emit = () => true;

    pubsub.dispatchPubSubEvent(
      [Buffer.from('subscribe'), Buffer.from('real-channel'), 1],
      emit,
    );

    const exposedSet = pubsub.subscribedChannels;

    assert.strictEqual(exposedSet.has('real-channel'), true);

    if (!(exposedSet instanceof Set)) {
      assert.fail('subscribedChannels must return a Set instance');
    }

    exposedSet.add('phantom-channel');
    exposedSet.delete('real-channel');

    const internalSet = pubsub.subscribedChannels;

    assert.strictEqual(internalSet.has('real-channel'), true);
    assert.strictEqual(internalSet.has('phantom-channel'), false);
    assert.strictEqual(exposedSet.has('phantom-channel'), true);
    assert.strictEqual(exposedSet.has('real-channel'), false);
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
});
