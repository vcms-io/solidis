/**
 * Reply-correlation STRESS — adversarial "try to break it" edition.
 *
 * Where 0026 verifies correlation under normal options, this suite deliberately
 * cripples the requester with degenerate limits (one command per pipeline, one
 * reply per processing chunk, byte-at-a-time socket writes, a tiny parser
 * buffer that must grow/shift constantly) and then floods it with tens of
 * thousands of commands whose answers are individually unique. Every reply is
 * checked against the command that produced it; the suite reports the observed
 * desync/loss rate and asserts it is exactly zero.
 *
 * If any configuration produces a single mismatch, the printed summary makes
 * the loss rate explicit so a regression can be quantified rather than merely
 * detected.
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  closeAllClients,
  closeClient,
  createClient,
  createKeyspace,
  range,
} from '../utils/index.ts';

import type { SolidisClientOptions } from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/index.ts';

interface BurstResult {
  total: number;
  mismatches: number;
  errors: number;
}

describe('stress-correlation', () => {
  const keyspace = createKeyspace('stress-correlation');
  const tracked: FeaturedClient[] = [];

  before(() => {
    /** nothing global; each test owns its degenerate client */
  });

  after(async () => {
    await Promise.all(tracked.map((client) => closeClient(client)));
    await closeAllClients();
  });

  const make = async (
    options: SolidisClientOptions,
  ): Promise<FeaturedClient> => {
    const client = await createClient(options);
    tracked.push(client);

    return client;
  };

  /**
   * Runs `count` self-verifying operations concurrently and tallies how many
   * replies failed to match the command that issued them.
   */
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
            /** Binary ECHO stresses the parser buffer with raw bytes. */
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
            await client.set(key, value);
            const reply = await client.get(key);

            if (reply !== value) {
              mismatches += 1;
              recordSample(`get -> ${reply}`);
            }

            return;
          }

          default: {
            /** A multi-reply pipeline whose internal order must be preserved. */
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
          sample.push(
            `THROW#${index}: ${(error as Error).message.slice(0, 60)}`,
          );
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

    assertClean('maxCommandsPerPipeline=1', await burst(client, 8000));
  });

  it('stays correlated with one reply per processing chunk', async () => {
    const client = await make({ maxProcessRepliesPerChunk: 1 });

    assertClean('maxProcessRepliesPerChunk=1', await burst(client, 8000));
  });

  it('stays correlated with byte-at-a-time socket writes', async () => {
    const client = await make({
      maxSocketWriteSizePerOnce: 1,
      commandTimeout: 0,
      socketWriteTimeout: 120000,
    });

    assertClean('maxSocketWriteSizePerOnce=1', await burst(client, 2000));
  });

  it('stays correlated with a tiny, constantly-resized parser buffer', async () => {
    const client = await make({
      parser: { buffer: { initial: 64, shiftThreshold: 16 } },
    });

    assertClean('tiny-parser-buffer', await burst(client, 8000));
  });

  it('stays correlated with every limit cranked to its worst case at once', async () => {
    const client = await make({
      maxCommandsPerPipeline: 1,
      maxProcessRepliesPerChunk: 1,
      maxSocketWriteSizePerOnce: 1,
      commandTimeout: 0,
      socketWriteTimeout: 120000,
      parser: { buffer: { initial: 32, shiftThreshold: 8 } },
    });

    assertClean('all-degenerate', await burst(client, 2000));
  });

  it('stays correlated across 24 degenerate clients pounding in parallel', async () => {
    const clients = await Promise.all(
      range(24).map((index) =>
        make({
          maxCommandsPerPipeline: 1 + (index % 3),
          maxProcessRepliesPerChunk: 1 + (index % 4),
        }),
      ),
    );

    const results = await Promise.all(
      clients.map((client) => burst(client, 600)),
    );

    const aggregate = results.reduce<BurstResult>(
      (sum, item) => ({
        total: sum.total + item.total,
        mismatches: sum.mismatches + item.mismatches,
        errors: sum.errors + item.errors,
      }),
      { total: 0, mismatches: 0, errors: 0 },
    );

    assertClean('24-way-degenerate', aggregate);
  });
});
