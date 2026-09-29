/** Reply-correlation stress with degenerate pipelines, fragmented sockets and large payloads. */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import {
  closeAllClients,
  closeClient,
  createClient,
  createKeyspace,
  range,
  resolveConnectionTarget,
} from '../utils/index.ts';

import type { SolidisClientOptions } from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/index.ts';

interface BurstResult {
  total: number;
  mismatches: number;
  errors: number;
}

function relay(from: net.Socket, to: net.Socket, chunkSize: number) {
  from.on('data', (data: Buffer) => {
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      to.write(data.subarray(offset, offset + chunkSize));
    }
  });
}

describe('stress-correlation', () => {
  const keyspace = createKeyspace('stress-correlation');
  const tracked: FeaturedClient[] = [];
  const proxies: net.Server[] = [];
  const proxySockets = new Set<net.Socket>();

  before(() => {});

  after(async () => {
    await Promise.all(tracked.map((client) => closeClient(client)));
    await closeAllClients();

    for (const socket of proxySockets) {
      socket.destroy();
    }

    await Promise.all(
      proxies.map(
        (proxy) =>
          new Promise<void>((resolve) => {
            proxy.close(() => resolve());
          }),
      ),
    );
  });

  async function startFragmentingProxy(
    requestChunkSize: number,
    replyChunkSize: number,
  ) {
    const target = resolveConnectionTarget();
    const proxy = net.createServer((downstream) => {
      const upstream = net.connect({ host: target.host, port: target.port });

      for (const socket of [downstream, upstream]) {
        proxySockets.add(socket);
        socket.setNoDelay(true);
        socket.on('error', () => {});
        socket.on('close', () => {
          proxySockets.delete(socket);
          downstream.destroy();
          upstream.destroy();
        });
      }

      relay(downstream, upstream, requestChunkSize);
      relay(upstream, downstream, replyChunkSize);
    });

    proxies.push(proxy);

    await new Promise<void>((resolve) => {
      proxy.listen(0, '127.0.0.1', resolve);
    });

    return { port: (proxy.address() as net.AddressInfo).port };
  }

  const make = async (
    options: SolidisClientOptions,
  ): Promise<FeaturedClient> => {
    const client = await createClient(options);
    tracked.push(client);

    return client;
  };

  async function burst(
    client: FeaturedClient,
    count: number,
  ): Promise<BurstResult> {
    let mismatches = 0;
    let errors = 0;
    const sample: string[] = [];

    const recordSample = (text: string) => {
      if (sample.length < 5) {
        sample.push(text);
      }
    };

    const checks = range(count).map(async (index) => {
      const tag = `${index}-${randomUUID()}`;

      try {
        switch (index % 6) {
          case 0: {
            const token = `echo-${tag}`;
            const reply = await client.echo(token);

            if (reply !== token) {
              mismatches += 1;
              recordSample(`echo ${token} -> ${reply}`);
            }

            return;
          }

          case 1: {
            const payload = randomBytes(48 + (index % 80));
            const reply = await client.echo(payload.toString('latin1'));

            if (reply !== payload.toString('latin1')) {
              mismatches += 1;
              recordSample(`binary-echo#${index}`);
            }

            return;
          }

          case 2: {
            const message = `ping-${tag}`;
            const reply = await client.ping(message);

            if (reply !== message) {
              mismatches += 1;
              recordSample(`ping ${message} -> ${reply}`);
            }

            return;
          }

          case 3: {
            const key = keyspace.key('incrby', tag);
            const amount = (index % 251) + 1;
            const reply = await client.incrby(key, amount);

            if (reply !== amount) {
              mismatches += 1;
              recordSample(`incrby ${amount} -> ${reply}`);
            }

            return;
          }

          case 4: {
            const key = keyspace.key('setget', tag);
            const value = `v-${tag}`;
            const setReply = await client.set(key, value);

            if (setReply !== 'OK') {
              mismatches += 1;
              recordSample(`set -> ${setReply}`);
            }

            const reply = await client.get(key);

            if (reply !== value) {
              mismatches += 1;
              recordSample(`get -> ${reply}`);
            }

            return;
          }

          default: {
            const key = keyspace.key('pipe', tag);
            const replies = await client.send([
              ['SET', key, tag],
              ['APPEND', key, '!'],
              ['GET', key],
            ]);

            const ok =
              replies[0][0] === 'OK' &&
              replies[1][0] === tag.length + 1 &&
              `${replies[2][0]}` === `${tag}!`;

            if (!ok) {
              mismatches += 1;
              recordSample(`pipeline#${index}`);
            }

            return;
          }
        }
      } catch (error) {
        errors += 1;
        if (sample.length < 5) {
          const message =
            error instanceof Error ? error.message : String(error);
          sample.push(`THROW#${index}: ${message.slice(0, 60)}`);
        }
      }
    });

    await Promise.all(checks);

    if (mismatches > 0 || errors > 0) {
      console.error(`  desync samples: ${sample.join(' | ')}`);
    }

    return { total: count, mismatches, errors };
  }

  const report = (label: string, result: BurstResult) => {
    const lossRate = ((result.mismatches + result.errors) / result.total) * 100;

    console.log(
      `[stress-correlation] ${label}: total=${result.total} ` +
        `mismatches=${result.mismatches} errors=${result.errors} ` +
        `lossRate=${lossRate.toFixed(4)}%`,
    );
  };

  const assertClean = (label: string, result: BurstResult) => {
    report(label, result);

    assert.strictEqual(
      result.mismatches,
      0,
      `${label}: ${result.mismatches} replies were mis-attributed to the wrong command`,
    );
    assert.strictEqual(
      result.errors,
      0,
      `${label}: ${result.errors} commands threw unexpectedly`,
    );
  };

  it('stays correlated with one command per pipeline chunk', async () => {
    const client = await make({ maxCommandsPerPipeline: 1 });

    assertClean('maxCommandsPerPipeline=1', await burst(client, 3000));
  });

  it('stays correlated when a proxy fragments every reply', async () => {
    const proxy = await startFragmentingProxy(Number.POSITIVE_INFINITY, 3);
    const client = await make({ host: '127.0.0.1', port: proxy.port });

    assertClean('reply-fragments=3', await burst(client, 3000));
  });

  it('stays correlated when a proxy fragments every request', async () => {
    const proxy = await startFragmentingProxy(1, Number.POSITIVE_INFINITY);
    const client = await make({ host: '127.0.0.1', port: proxy.port });

    assertClean('request-fragments=1', await burst(client, 500));
  });

  for (const [label, replyChunkSize] of [
    ['direct', Number.POSITIVE_INFINITY],
    ['fragmented', 1000],
  ] as const) {
    it(`keeps payloads around the zero-copy threshold intact (${label})`, async () => {
      const proxy = await startFragmentingProxy(
        Number.POSITIVE_INFINITY,
        replyChunkSize,
      );
      const client = await make({ host: '127.0.0.1', port: proxy.port });
      const threshold = 64 * 1024;
      const payloads = range(40).map((index) =>
        randomBytes(threshold - 512 + ((index * 97) % 1024)),
      );
      const keys = payloads.map((_, index) =>
        keyspace.key('zero-copy', label, index),
      );

      await client.send(
        keys.map((key, index) => ['SET', key, payloads[index]]),
      );

      const replies = await client.send(keys.map((key) => ['GET', key]));

      for (const [index, [reply]] of replies.entries()) {
        assert.ok(Buffer.isBuffer(reply));
        assert.ok(reply.equals(payloads[index]), `payload #${index}`);
      }

      const mixed = await Promise.all(
        keys.map(async (key, index) => {
          const [[[value]], echo] = await Promise.all([
            client.send([['GET', key]]),
            client.echo(`small-${index}`),
          ]);

          return (
            Buffer.isBuffer(value) &&
            value.equals(payloads[index]) &&
            echo === `small-${index}`
          );
        }),
      );

      assert.deepStrictEqual(
        mixed,
        keys.map(() => true),
      );
    });
  }

  it('stays correlated with every degenerate setting at once', async () => {
    const proxy = await startFragmentingProxy(2, 2);
    const client = await make({
      host: '127.0.0.1',
      port: proxy.port,
      maxCommandsPerPipeline: 1,
      commandTimeout: 0,
    });

    assertClean('all-degenerate', await burst(client, 500));
  });

  it('stays correlated across 12 degenerate clients pounding in parallel', async () => {
    const proxy = await startFragmentingProxy(5, 7);
    const clients = await Promise.all(
      range(12).map((index) =>
        make({
          maxCommandsPerPipeline: 1 + (index % 3),
          ...(index % 2 === 0 ? { host: '127.0.0.1', port: proxy.port } : {}),
        }),
      ),
    );

    const results = await Promise.all(
      clients.map((client) => burst(client, 300)),
    );

    const aggregate = results.reduce<BurstResult>(
      (sum, item) => ({
        total: sum.total + item.total,
        mismatches: sum.mismatches + item.mismatches,
        errors: sum.errors + item.errors,
      }),
      { total: 0, mismatches: 0, errors: 0 },
    );

    assertClean('12-way-degenerate', aggregate);
  });
});
