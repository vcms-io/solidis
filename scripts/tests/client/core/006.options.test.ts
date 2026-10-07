/** Connection URI parsing and option resolution. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  parseConnectionUri,
  resolveClientOptions,
  SolidisDefaultOptions,
} from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  formatTargetAddress,
  track,
} from '../../utils/index.ts';

describe('options', () => {
  const keyspace = createKeyspace('options');

  describe('parseConnectionUri', () => {
    it('reads every part of a redis URI', () => {
      assert.deepStrictEqual(
        parseConnectionUri('redis://alice:s3cret@cache.local:6380/2'),
        {
          host: 'cache.local',
          port: 6380,
          authentication: { username: 'alice', password: 's3cret' },
          database: 2,
        },
      );
    });

    it('percent-decodes credentials', () => {
      assert.deepStrictEqual(
        parseConnectionUri('redis://us%3Aer:p%40ss%2Fword%25@host')
          .authentication,
        { username: 'us:er', password: 'p@ss/word%' },
      );
    });

    it('keeps a malformed percent escape verbatim', () => {
      assert.deepStrictEqual(
        parseConnectionUri('redis://:%zz@host').authentication,
        { username: '', password: '%zz' },
      );
    });

    it('authenticates the default user when only a password is given', () => {
      assert.deepStrictEqual(parseConnectionUri('redis://:secret@host'), {
        host: 'host',
        authentication: { username: '', password: 'secret' },
      });
    });

    it('reads a user without a password as that user with an empty password', () => {
      assert.deepStrictEqual(parseConnectionUri('redis://name@host'), {
        host: 'host',
        authentication: { username: 'name', password: '' },
      });
    });

    it('strips the brackets of an IPv6 host', () => {
      assert.deepStrictEqual(parseConnectionUri('redis://[::1]:6379'), {
        host: '::1',
        port: 6379,
      });
    });

    it('reads the host as an http URL does, and rejects one it would not accept', () => {
      for (const [uri, host] of [
        ['redis://loc%61lhost:6379', 'localhost'],
        ['redis://LOCALHOST', 'localhost'],
        ['redis://bücher.example', 'xn--bcher-kva.example'],
        ['rediss://b%C3%BCcher.example', 'xn--bcher-kva.example'],
        ['redis://[0:0::1]', '::1'],
      ]) {
        assert.strictEqual(parseConnectionUri(uri).host, host, uri);
      }

      for (const uri of ['redis://a%00b', 'redis://a%2Fb:6379']) {
        assert.throws(() => parseConnectionUri(uri), {
          name: 'SolidisClientError',
          message: 'Invalid URI',
        });
      }
    });

    it('enables TLS for rediss', () => {
      assert.deepStrictEqual(parseConnectionUri('rediss://secure.example'), {
        host: 'secure.example',
        tls: {},
      });
    });

    it('accepts a URL object', () => {
      assert.deepStrictEqual(
        parseConnectionUri(new URL('redis://host:7000/0')),
        { host: 'host', port: 7000, database: 0 },
      );
    });

    it('omits every part the URI leaves out', () => {
      assert.deepStrictEqual(parseConnectionUri('redis://host'), {
        host: 'host',
      });
      assert.deepStrictEqual(parseConnectionUri('redis://host/'), {
        host: 'host',
      });
    });

    it('rejects other schemes', () => {
      for (const uri of ['http://host', 'tcp://host:6379', 'valkey://host']) {
        assert.throws(() => parseConnectionUri(uri), {
          name: 'SolidisClientError',
          message: `Unsupported URI scheme '${new URL(uri).protocol}', expected redis: or rediss:`,
        });
      }
    });

    it('rejects a URI without an authority, and keeps an empty host', () => {
      for (const uri of [
        'redis:',
        'redis:5',
        'redis:6380',
        'redis:localhost:6380',
        'rediss:cache.example.com',
        new URL('redis:5'),
      ]) {
        assert.throws(() => parseConnectionUri(uri), {
          name: 'SolidisClientError',
          message: 'Invalid URI',
        });
      }

      assert.deepStrictEqual(parseConnectionUri('redis:///2'), { database: 2 });
    });

    it('rejects a database that is not a non-negative integer', () => {
      for (const database of [
        'x',
        '-1',
        '1.5',
        '2/3',
        '1e3x',
        '999999999999999999999',
        '0x10',
        '1e1',
        '1.0',
        '+3',
        '0b11',
        '0o7',
      ]) {
        assert.throws(() => parseConnectionUri(`redis://host/${database}`), {
          name: 'SolidisClientError',
          message: 'Invalid database in URI',
        });
      }
    });
  });

  describe('resolveClientOptions', () => {
    it('returns the documented defaults for no options', () => {
      assert.deepStrictEqual(resolveClientOptions({}), {
        authentication: { username: '', password: '' },
        autoReconnect: true,
        autoRecovery: {
          database: true,
          subscribe: true,
          ssubscribe: true,
          psubscribe: true,
        },
        clientName: 'solidis',
        commandTimeout: 5000,
        connectionTimeout: 2000,
        connectionRetryDelay: 100,
        database: 0,
        debug: false,
        enableReadyCheck: true,
        host: '127.0.0.1',
        uri: false,
        lazyConnect: false,
        maxConnectionRetries: 20,
        maxConnectionRetryDelay: 2000,
        maxCommandsPerPipeline: 300,
        maxEventListenersForClient: 10_240,
        parser: { maxBulkStringLength: 536_870_912 },
        port: 6379,
        protocol: 'RESP2',
        readyCheckInterval: 100,
        maxReadyCheckRetries: 100,
        rejectOnPartialPipelineError: false,
      });
    });

    it('ignores undefined nested options', () => {
      const resolved = resolveClientOptions({
        uri: 'redis://alice:secret@uri-host',
        authentication: { password: undefined },
        parser: { maxBulkStringLength: undefined },
      });

      assert.deepStrictEqual(resolved.authentication, {
        username: 'alice',
        password: 'secret',
      });
      assert.strictEqual(resolved.parser.maxBulkStringLength, 536_870_912);
    });

    it('lets explicit options override the URI part by part', () => {
      const resolved = resolveClientOptions({
        uri: 'redis://alice:secret@uri-host:7000/3',
        host: 'explicit-host',
        database: undefined,
        authentication: { password: 'override' },
      });

      assert.strictEqual(resolved.host, 'explicit-host');
      assert.strictEqual(resolved.port, 7000);
      assert.strictEqual(resolved.database, 3);
      assert.deepStrictEqual(resolved.authentication, {
        username: 'alice',
        password: 'override',
      });
    });

    it('merges nested options with their defaults', () => {
      const resolved = resolveClientOptions({
        autoRecovery: { subscribe: false, database: undefined },
        parser: { maxBulkStringLength: 10 },
      });

      assert.deepStrictEqual(resolved.autoRecovery, {
        ...SolidisDefaultOptions.autoRecovery,
        subscribe: false,
      });
      assert.deepStrictEqual(resolved.parser, { maxBulkStringLength: 10 });
    });

    it('reads options through getters and prototypes, like the URI', () => {
      class Configuration {
        get host() {
          return 'getter-host';
        }

        get authentication() {
          return Object.create({ username: 'inherited' });
        }
      }

      const fromClass = resolveClientOptions(new Configuration());
      const inherited = resolveClientOptions(
        Object.create({
          uri: 'redis://uri-host:6380/3',
          port: 7000,
          tls: { servername: 'name' },
          parser: Object.create({ maxBulkStringLength: 10 }),
        }),
      );

      assert.strictEqual(fromClass.host, 'getter-host');
      assert.deepStrictEqual(fromClass.authentication, {
        username: 'inherited',
        password: '',
      });
      assert.strictEqual(inherited.host, 'uri-host');
      assert.strictEqual(inherited.port, 7000);
      assert.strictEqual(inherited.database, 3);
      assert.deepStrictEqual(inherited.tls, { servername: 'name' });
      assert.strictEqual(inherited.parser.maxBulkStringLength, 10);
      assert.strictEqual(
        Reflect.get(resolveClientOptions(JSON.parse('{"extra":1}')), 'extra'),
        undefined,
      );
    });

    it('never mutates the shared defaults', () => {
      const snapshot = structuredClone(SolidisDefaultOptions);
      const resolved = resolveClientOptions({
        authentication: { username: 'someone' },
      });

      resolved.autoRecovery.subscribe = false;

      assert.deepStrictEqual(SolidisDefaultOptions, snapshot);
    });

    it('rejects an unsupported URI when the client is created', () => {
      assert.throws(
        () =>
          new SolidisFeaturedClient({ uri: 'http://host', lazyConnect: true }),
        { name: 'SolidisClientError' },
      );
    });
  });

  it('connects through a URI and selects its database', async () => {
    const key = keyspace.key('uri-database');
    const client = track(
      new SolidisFeaturedClient({
        uri: `redis://${formatTargetAddress()}/5`,
        lazyConnect: true,
      }),
    );

    client.on('error', () => {});

    const verifier = await createClient({ database: 5 });

    try {
      await client.connect();
      await client.set(key, 'in-database-5');

      assert.strictEqual(await verifier.get(key), 'in-database-5');
    } finally {
      await closeClient(client);
      await closeClient(verifier);
    }
  });
});
