import { SolidisDefaultOptions } from '../constants.ts';
import { SolidisClientError } from './error.ts';

import type {
  SolidisClientFrozenOptions,
  SolidisClientOptions,
} from '../../types/solidis.ts';

function decodeUriComponent(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function removeUndefined(value: object | undefined) {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter((entry) => entry[1] !== undefined),
  );
}

export function parseConnectionUri(uri: string | URL): SolidisClientOptions {
  let url: URL;

  try {
    url = typeof uri === 'string' ? new URL(uri) : uri;
  } catch {
    throw new SolidisClientError('Invalid URI');
  }

  if (!/^rediss?:$/.test(url.protocol)) {
    throw new SolidisClientError(
      `Unsupported URI scheme '${url.protocol}', expected redis: or rediss:`,
    );
  }

  const options: SolidisClientOptions = {};
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  const username = decodeUriComponent(url.username);
  const password = decodeUriComponent(url.password);
  const database = url.pathname.slice(1);

  if (host) {
    options.host = host;
  }

  if (url.port) {
    options.port = Number(url.port);
  }

  if (username || password) {
    options.authentication = { username, password };
  }

  if (database) {
    const index = Number(database);

    if (!Number.isInteger(index) || index < 0) {
      throw new SolidisClientError(`Invalid database '${database}' in URI`);
    }

    options.database = index;
  }

  if (url.protocol === 'rediss:') {
    options.tls = {};
  }

  return options;
}

export function resolveClientOptions(
  options: SolidisClientOptions,
): SolidisClientFrozenOptions {
  const uriOptions = options.uri ? parseConnectionUri(options.uri) : {};

  return {
    ...SolidisDefaultOptions,
    ...uriOptions,
    ...removeUndefined(options),
    authentication: {
      ...SolidisDefaultOptions.authentication,
      ...uriOptions.authentication,
      ...removeUndefined(options.authentication),
    },
    autoRecovery: {
      ...SolidisDefaultOptions.autoRecovery,
      ...removeUndefined(options.autoRecovery),
    },
    parser: {
      ...SolidisDefaultOptions.parser,
      ...removeUndefined(options.parser),
    },
  };
}
