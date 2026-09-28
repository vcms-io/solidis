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

export type FeaturedClient = SolidisFeaturedClient;

const activeClients = new Set<SolidisFeaturedClient>();

/**
 * Creates a client and resolves only once it has signalled `ready`, so tests
 * never race the initial handshake. Created clients are tracked and force
 * closed by {@link closeAllClients} as a safety net.
 */
export async function createClient(
  overrides: SolidisClientOptions = {},
): Promise<SolidisFeaturedClient> {
  const client = new SolidisFeaturedClient(
    buildClientOptions({ lazyConnect: true, ...overrides }),
  );

  activeClients.add(client);

  client.on('error', () => {
    /**
     * Swallow asynchronous transport errors here; assertions that care about
     * failures await the relevant command promise directly. Without this
     * listener Node would treat the emitted error as unhandled.
     */
  });

  await client.connect();

  return client;
}

export async function closeClient(
  client: SolidisFeaturedClient,
): Promise<void> {
  activeClients.delete(client);

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    client.once('end', finish);
    client.quit();

    setTimeout(finish, 200);
  });
}

export async function closeAllClients(): Promise<void> {
  const pending = Array.from(activeClients).map((client) =>
    closeClient(client),
  );

  await Promise.all(pending);
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
