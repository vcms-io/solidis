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

function resolveLayers<T extends object>(
  defaults: T,
  layers: unknown[],
  keys = Object.keys(defaults),
) {
  const result = { ...defaults };

  for (const key of keys) {
    const fallback: unknown = Reflect.get(defaults, key);
    const values = layers.map((layer) => Reflect.get(Object(layer), key));
    const value =
      fallback && typeof fallback === 'object'
        ? resolveLayers(fallback, values)
        : [fallback, ...values].findLast((entry) => entry !== undefined);

    if (value !== undefined) {
      Reflect.set(result, key, value);
    }
  }

  return result;
}

export function parseConnectionUri(uri: string | URL): SolidisClientOptions {
  let url: URL | undefined;
  let host: string | undefined;

  try {
    url = new URL(uri);
    host = url.hostname && new URL(`http://${url.host}`).hostname;
  } catch {
    url = undefined;
  }

  if (url && !/^rediss?:$/.test(url.protocol)) {
    throw new SolidisClientError(
      `Unsupported URI scheme '${url.protocol}', expected redis: or rediss:`,
    );
  }

  if (!url?.href.startsWith(`${url.protocol}//`)) {
    throw new SolidisClientError('Invalid URI');
  }

  const options: SolidisClientOptions = {};
  const username = decodeUriComponent(url.username);
  const password = decodeUriComponent(url.password);
  const database = url.pathname.slice(1);

  if (host) {
    options.host = host.replace(/[[\]]/g, '');
  }

  if (url.port) {
    options.port = Number(url.port);
  }

  if (username || password) {
    options.authentication = { username, password };
  }

  if (database) {
    const index = Number(database);

    if (!/^\d+$/.test(database) || !Number.isSafeInteger(index)) {
      throw new SolidisClientError('Invalid database in URI');
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
  return resolveLayers(
    SolidisDefaultOptions,
    [options.uri ? parseConnectionUri(options.uri) : {}, options],
    [...Object.keys(SolidisDefaultOptions), 'tls'],
  );
}
