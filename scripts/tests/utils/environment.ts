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
  protocol?: SolidisProtocols;
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
  const text = value?.trim() ?? '';
  const port = Number(text);

  if (!/^\d+$/.test(text) || port < 1 || port > 65_535) {
    throw new Error(
      'Set SOLIDIS_TEST_PORT to the port of a disposable server: the suites flush its data.',
    );
  }

  return port;
}

export function resolveConnectionTarget(): TestConnectionTarget {
  const host = process.env.SOLIDIS_TEST_HOST ?? '127.0.0.1';
  const port = readPort(process.env.SOLIDIS_TEST_PORT);

  return {
    host,
    port,
    protocol: readProtocol(process.env.SOLIDIS_TEST_PROTOCOL),
  };
}

/** The test server as a URI writes it: an IPv6 address goes in brackets. */
export function formatTargetAddress() {
  const { host, port } = resolveConnectionTarget();

  return `${host.includes(':') ? `[${host}]` : host}:${port}`;
}

export function buildClientOptions(
  overrides: SolidisClientOptions = {},
): SolidisClientOptions {
  const target = resolveConnectionTarget();

  return {
    host: target.host,
    port: target.port,
    protocol: target.protocol,
    ...overrides,
  };
}
