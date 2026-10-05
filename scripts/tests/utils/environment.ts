/**
 * Resolves connection settings from the environment so the same suite can run
 * against a locally launched server or the continuous-integration matrix
 * (Redis and Valkey) without code changes.
 */

import { SolidisProtocols } from '../../../sources/index.ts';

import type { SolidisClientOptions } from '../../../sources/index.ts';

export interface TestConnectionTarget {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: SolidisProtocols;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
}

function readProtocol(value: string | undefined) {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const protocol = value.trim().toUpperCase();

  if (
    protocol !== SolidisProtocols.RESP2 &&
    protocol !== SolidisProtocols.RESP3
  ) {
    throw new Error(
      `SOLIDIS_TEST_PROTOCOL must be RESP2 or RESP3, got '${value}'`,
    );
  }

  return protocol;
}

function readPort(value: string | undefined) {
  const port = readNumber(value, Number.NaN);

  if (!Number.isInteger(port)) {
    throw new Error(
      'Set SOLIDIS_TEST_PORT to the port of a disposable server: the suites flush its data.',
    );
  }

  return port;
}

export function resolveConnectionTarget(): TestConnectionTarget {
  const host = process.env.SOLIDIS_TEST_HOST ?? '127.0.0.1';
  const port = readPort(process.env.SOLIDIS_TEST_PORT);
  const username = process.env.SOLIDIS_TEST_USERNAME;
  const password = process.env.SOLIDIS_TEST_PASSWORD;

  return {
    host,
    port,
    username: username && username.length > 0 ? username : undefined,
    password: password && password.length > 0 ? password : undefined,
    protocol: readProtocol(process.env.SOLIDIS_TEST_PROTOCOL),
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
    protocol: target.protocol,
    ...overrides,
  };
}
