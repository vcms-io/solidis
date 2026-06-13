/**
 * Resolves connection settings from the environment so the same suite can run
 * against a locally launched server, the docker-compose topology, or the
 * continuous-integration matrix (Redis and Valkey) without code changes.
 */

import type { SolidisClientOptions } from '../../../sources/index.ts';

export interface TestConnectionTarget {
  label: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
}

export function resolveConnectionTarget(): TestConnectionTarget {
  const host = process.env.SOLIDIS_TEST_HOST ?? '127.0.0.1';
  const port = readNumber(process.env.SOLIDIS_TEST_PORT, 6379);
  const username = process.env.SOLIDIS_TEST_USERNAME;
  const password = process.env.SOLIDIS_TEST_PASSWORD;
  const label = process.env.SOLIDIS_TEST_LABEL ?? `${host}:${port}`;

  return {
    label,
    host,
    port,
    username: username && username.length > 0 ? username : undefined,
    password: password && password.length > 0 ? password : undefined,
  };
}

export function buildClientOptions(
  overrides: SolidisClientOptions = {},
): SolidisClientOptions {
  const target = resolveConnectionTarget();

  const authentication =
    target.username || target.password
      ? { username: target.username, password: target.password }
      : undefined;

  return {
    host: target.host,
    port: target.port,
    authentication,
    ...overrides,
  };
}
