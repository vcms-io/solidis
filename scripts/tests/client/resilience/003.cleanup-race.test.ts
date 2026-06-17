/** Cleanup race: deferred end-callback in cleanup() targets the wrong socket during reconnection. */

import { afterEach, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  closeClient,
  createClient,
  MockRedisServer,
  mockClientOptions,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('cleanup-race', () => {
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

  it('reconnects after an abrupt mock-server disconnect with no retries', async () => {
    const server = await startMockServer();

    const client = trackMockClient(
      new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          maxConnectionRetries: 0,
          connectionTimeout: 2000,
        }),
      ),
    );

    await client.connect();

    let reconnected = false;

    client.on('ready', () => {
      reconnected = true;
    });

    server.destroySockets();

    await waitFor(() => reconnected, {
      timeout: 3000,
      interval: 50,
      description: 'reconnect after abrupt mock disconnect',
    });
  });

  it('reconnects after a forced CLIENT KILL with no retries', async () => {
    const client = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 0,
      connectionTimeout: 2000,
    });

    const killer = await createClient();

    try {
      const clientId = await client.clientId();

      let reconnected = false;

      client.on('ready', () => {
        reconnected = true;
      });

      await killer.clientKill(clientId);

      await waitFor(() => reconnected, {
        timeout: 3000,
        interval: 50,
        description: 'reconnect after CLIENT KILL',
      });
    } finally {
      await closeClient(killer);
      await closeClient(client);
    }
  });
});
