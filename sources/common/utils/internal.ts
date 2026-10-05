import { SolidisMaximumTimerDelay } from '../internal.ts';

export const SolidisSocketNotConnectedMessage = 'Socket is not connected.';
export const SolidisConnectionClosedMessage = 'Connection closed.';
export const SolidisClientQuitMessage = 'The client was quit.';

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
