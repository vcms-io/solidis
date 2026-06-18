/** Reply race: fire-and-forget dispatch in resolveRepliesInChunks desynchronises reply correlation. */

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import { MockRedisServer, mockClientOptions } from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('reply-race', () => {
  const mockClients: FeaturedClient[] = [];
  const mockServers: MockRedisServer[] = [];

  const trackMockClient = (client: FeaturedClient): FeaturedClient => {
    client.on('error', () => {});
    mockClients.push(client);

    return client;
  };

  const startMockServer = async (): Promise<MockRedisServer> => {
    const server = new MockRedisServer();
    mockServers.push(server);
    await server.listen();

    return server;
  };

  afterEach(async () => {
    for (const client of mockClients.splice(0)) {
      client.quit();
    }

    for (const server of mockServers.splice(0)) {
      await server.close();
    }
  });

  it('attributes every reply to the correct pipeline across chunked processing', async () => {
    const server = await startMockServer();

    const commandCount = 200;

    let responded = false;

    server.onData((socket) => {
      if (responded) {
        return;
      }

      responded = true;

      socket.setNoDelay(true);

      const repliesForPrimary = '+a\r\n'.repeat(commandCount);

      socket.write(Buffer.from(repliesForPrimary, 'latin1'));

      setTimeout(() => {
        socket.write(Buffer.from('+b\r\n', 'latin1'));
      }, 0);
    });

    const client = trackMockClient(
      new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          maxProcessRepliesPerChunk: 1,
          maxProcessReplyBytesPerChunk: 12,
          maxCommandsPerPipeline: commandCount,
          commandTimeout: 10000,
        }),
      ),
    );

    await client.connect();

    const primaryCommands = Array.from({ length: commandCount }, () => [
      'ECHO',
      'a',
    ]);
    const secondaryCommands = [['ECHO', 'b']];

    const primaryPipeline = client.send(primaryCommands);
    const secondaryPipeline = client.send(secondaryCommands);

    const [primaryReplies, secondaryReplies] = await Promise.all([
      primaryPipeline,
      secondaryPipeline,
    ]);

    assert.strictEqual(primaryReplies.length, commandCount);

    assert.deepStrictEqual(
      primaryReplies,
      Array.from({ length: commandCount }, () => ['a']),
    );

    assert.deepStrictEqual(secondaryReplies, [['b']]);
  });

  it('preserves reply order under a different byte-chunk alignment', async () => {
    const server = await startMockServer();

    const commandCount = 100;

    let responded = false;

    server.onData((socket) => {
      if (responded) {
        return;
      }

      responded = true;

      socket.setNoDelay(true);

      const repliesForPrimary = '+x\r\n'.repeat(commandCount);

      socket.write(Buffer.from(repliesForPrimary, 'latin1'));

      setTimeout(() => {
        socket.write(Buffer.from('+y\r\n', 'latin1'));
      }, 0);
    });

    const client = trackMockClient(
      new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          maxProcessRepliesPerChunk: 1,
          maxProcessReplyBytesPerChunk: 14,
          maxCommandsPerPipeline: commandCount,
          commandTimeout: 10000,
        }),
      ),
    );

    await client.connect();

    const primaryCommands = Array.from({ length: commandCount }, () => [
      'ECHO',
      'x',
    ]);
    const secondaryCommands = [['ECHO', 'y']];

    const primaryPipeline = client.send(primaryCommands);
    const secondaryPipeline = client.send(secondaryCommands);

    const [primaryReplies, secondaryReplies] = await Promise.all([
      primaryPipeline,
      secondaryPipeline,
    ]);

    assert.strictEqual(primaryReplies.length, commandCount);

    assert.deepStrictEqual(
      primaryReplies,
      Array.from({ length: commandCount }, () => ['x']),
    );

    assert.deepStrictEqual(secondaryReplies, [['y']]);
  });
});
