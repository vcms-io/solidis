/**
 * Client lifecycle helpers and server-capability detection.
 *
 * Every suite creates clients through {@link createClient} so connection
 * teardown is centralised and leak-free. Capability detection lets individual
 * tests gracefully skip features that depend on a specific server version
 * (for example hash-field expiration) or an optional module (RedisJSON, Bloom,
 * Time-Series) without failing the whole run.
 */

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { buildClientOptions } from './environment.ts';

import type {
  SolidisClientOptions,
  SolidisData,
  StringOrBuffer,
} from '../../../sources/index.ts';
import type { SolidisConnection } from '../../../sources/modules/connection.ts';

export type FeaturedClient = SolidisFeaturedClient;

const activeClients = new Set<Pick<SolidisConnection, 'quit'>>();

/**
 * Registers a client or a bare connection that a test builds itself, so
 * {@link closeAllClients} quits it also when the test fails before it does.
 */
export function track<T extends Pick<SolidisConnection, 'quit'>>(client: T): T {
  activeClients.add(client);

  return client;
}

/**
 * Creates a client and resolves only once it has signalled `ready`, so tests
 * never race the initial handshake. Created clients are tracked and force
 * closed by {@link closeAllClients} as a safety net.
 */
export async function createClient(
  overrides: SolidisClientOptions = {},
): Promise<SolidisFeaturedClient> {
  const client = track(
    new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true, ...overrides }),
    ),
  );

  client.on('error', () => {
    /**
     * Swallow asynchronous transport errors here; assertions that care about
     * failures await the relevant command promise directly. Without this
     * listener they would print as process warnings.
     */
  });

  await client.connect();

  return client;
}

export async function closeClient(
  client: SolidisFeaturedClient,
): Promise<void> {
  activeClients.delete(client);
  client.quit();
}

/**
 * Reads the server's clock in milliseconds, so expiry assertions hold on a
 * server whose clock differs from the machine running the tests.
 */
export async function readServerTime(
  client: Pick<SolidisFeaturedClient, 'time'>,
): Promise<number> {
  const [seconds, microseconds] = await client.time();

  return seconds * 1000 + Math.floor(microseconds / 1000);
}

/**
 * Runs `run` with a server parameter set to `value` and sets it back to what
 * it was, also when `run` fails.
 */
export async function withConfig<T>(
  client: Pick<SolidisFeaturedClient, 'configGet' | 'configSet'>,
  parameter: string,
  value: string,
  run: () => Promise<T>,
): Promise<T> {
  const original = (await client.configGet(parameter))[parameter];

  if (original === undefined) {
    throw new Error(`The server has no parameter ${parameter}`);
  }

  await client.configSet(parameter, value);

  try {
    return await run();
  } finally {
    await client.configSet(parameter, original);
  }
}

/**
 * Runs `run` while the server writes every command it executes to its slow
 * log, and returns the arguments of the logged commands named `name`, oldest
 * first: the trace of an option whose effect the server does not show.
 */
export async function readLoggedCommands(
  client: Pick<
    SolidisFeaturedClient,
    'configGet' | 'configSet' | 'slowlogGet' | 'slowlogReset'
  >,
  name: string,
  run: () => Promise<unknown>,
): Promise<string[][]> {
  await client.slowlogReset();
  await withConfig(client, 'slowlog-log-slower-than', '0', run);

  return (await client.slowlogGet(128))
    .map((entry) => entry.commandArguments)
    .filter(([command]) => command === name)
    .reverse();
}

/** Whether the server reports the client with this id as blocked in a command. */
export async function isBlocked(
  observer: Pick<SolidisFeaturedClient, 'clientList'>,
  clientId: number,
): Promise<boolean> {
  return /\bflags=\S*b/.test(
    await observer.clientList({ identifiers: [clientId] }),
  );
}

export function closeAllClients(): void {
  for (const client of activeClients) {
    client.quit();
  }

  activeClients.clear();
}

export interface ServerCapabilities {
  rawVersion: string;
  major: number;
  minor: number;
  patch: number;
  isValkey: boolean;
  modules: Set<string>;
  atLeast(major: number, minor: number): boolean;
  hasModule(name: string): boolean;
}

function parseVersion(version: string): [number, number, number] {
  const segments = version
    .split('.')
    .map((segment) => Number.parseInt(segment, 10));

  return [segments[0] ?? 0, segments[1] ?? 0, segments[2] ?? 0];
}

async function detectModules(
  client: SolidisFeaturedClient,
): Promise<Set<string>> {
  const modules = new Set<string>();

  try {
    const reply = await client.send([['MODULE', 'LIST']]);
    const entries = reply[0]?.[0];

    if (!Array.isArray(entries)) {
      return modules;
    }

    for (const entry of entries) {
      collectModuleName(entry, modules);
    }
  } catch {
    /** MODULE LIST may be disabled; treat as "no modules available". */
  }

  return modules;
}

function collectModuleName(entry: SolidisData, modules: Set<string>): void {
  if (Array.isArray(entry)) {
    const nameIndex = entry.findIndex(
      (item) => `${item}`.toLowerCase() === 'name',
    );

    if (nameIndex >= 0 && entry[nameIndex + 1] !== undefined) {
      modules.add(`${entry[nameIndex + 1]}`.toLowerCase());
    }

    return;
  }

  if (entry instanceof Map) {
    const name = entry.get('name');

    if (name !== undefined) {
      modules.add(`${name}`.toLowerCase());
    }
  }
}

export async function detectServerCapabilities(
  client: SolidisFeaturedClient,
): Promise<ServerCapabilities> {
  const serverInfo = await client.info('server');

  const isValkey =
    serverInfo.valkey_version !== undefined ||
    (serverInfo.server_name ?? '').toLowerCase().includes('valkey');

  /**
   * Valkey advertises its real version under valkey_version while keeping
   * redis_version pinned to a compatibility baseline, so prefer the former
   * when present to gate version-dependent features correctly.
   */
  const rawVersion =
    (isValkey ? serverInfo.valkey_version : serverInfo.redis_version) ??
    serverInfo.redis_version ??
    serverInfo.valkey_version ??
    '0.0.0';
  const [major, minor, patch] = parseVersion(rawVersion);

  const modules = await detectModules(client);

  return {
    rawVersion,
    major,
    minor,
    patch,
    isValkey,
    modules,
    atLeast(targetMajor, targetMinor) {
      if (major !== targetMajor) {
        return major > targetMajor;
      }

      return minor >= targetMinor;
    },
    hasModule(name) {
      return modules.has(name.toLowerCase());
    },
  };
}

/**
 * Returns whether the server recognises a command, used to skip module-only
 * suites independently of module naming differences across distributions.
 */
export async function isCommandSupported(
  client: SolidisFeaturedClient,
  command: StringOrBuffer[],
): Promise<boolean> {
  const isUnknownCommand = (value: unknown): boolean =>
    value instanceof Error && /unknown command/i.test(value.message);

  try {
    const reply = await client.send([command]);

    /**
     * A raw pipeline surfaces command errors as inline RespError values rather
     * than rejecting, so the unknown-command probe must inspect the reply.
     */
    return !isUnknownCommand(reply[0]?.[0]);
  } catch (error) {
    /**
     * If the probe itself rejects, a non-"unknown command" error still proves
     * the command is registered (it failed on arity/type instead).
     */
    return !isUnknownCommand(error);
  }
}
