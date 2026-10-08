import { SolidisMaximumTimerDelay } from '../internal.ts';

import type { CommandGeoSearchOptions } from '../../types/command.ts';
import type { StringOrBuffer } from '../../types/solidis.ts';

export const SolidisSocketNotConnectedMessage = 'Socket is not connected.';
export const SolidisConnectionClosedMessage = 'Connection closed.';
export const SolidisClientQuitMessage = 'The client was quit.';

export function formatBlockingTimeout(timeout: number) {
  return timeout > 0 && timeout <= 0.001 ? '0.0011' : `${timeout}`;
}

export function isStringOrBuffer(value: unknown): value is StringOrBuffer {
  return typeof value === 'string' || Buffer.isBuffer(value);
}

export function readText(value: unknown) {
  return isStringOrBuffer(value) ? value.toString() : undefined;
}

export function toBinaryBuffer(value: StringOrBuffer) {
  return typeof value === 'string' ? Buffer.from(value, 'latin1') : value;
}

export function formatInteger(value: number | bigint | string) {
  return `${Number.isSafeInteger(value) || !Number.isInteger(value) ? value : BigInt(value)}`;
}

export function formatFloat(value: number) {
  return value === 0 && 1 / value < 0 ? '-0' : `${value}`;
}

export function formatNumber(value: number) {
  return value === 0 && 1 / value < 0 ? '-0' : formatInteger(value);
}

export function appendItems<Item>(command: Item[], items: readonly Item[]) {
  for (const item of items) {
    command.push(item);
  }

  return command;
}

export function toTextPrefix(argument: string | Buffer, length: number) {
  return typeof argument === 'string'
    ? argument.slice(0, length)
    : argument.toString('utf8', 0, length * 4);
}

export function wrapWithSolidisError<T extends Error>(
  ErrorClass: new (message: string, cause?: unknown) => T,
  error: unknown,
): T {
  if (error instanceof ErrorClass) {
    return error;
  }

  return new ErrorClass(
    error instanceof Error
      ? error.message || ('errors' in error ? `${error.errors}` : '')
      : String(error),
    error,
  );
}

export function resolveTimerDelay(delay: number) {
  return delay > 0 && delay <= SolidisMaximumTimerDelay ? delay : 0;
}

export function readGeoReplyOptions(options?: CommandGeoSearchOptions) {
  return {
    withDist: options?.withDist,
    withHash: options?.withHash,
    withCoord: options?.withCoord,
  };
}
