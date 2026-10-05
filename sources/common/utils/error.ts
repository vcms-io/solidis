import { wrapWithSolidisError } from './internal.ts';

export class SolidisError extends Error {
  public name = 'SolidisError';

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}

export class RespError extends SolidisError {
  public name = 'RespError';
  public readonly code: string;

  constructor(message: string) {
    const { stackTraceLimit } = Error;

    Reflect.set(Error, 'stackTraceLimit', 0);

    super(message);

    Reflect.set(Error, 'stackTraceLimit', stackTraceLimit);
    this.stack = undefined;
    this.code = message.split(' ', 1)[0];
  }
}

export class SolidisClientError extends SolidisError {
  public name = 'SolidisClientError';
}

export class SolidisCommandError extends SolidisError {
  public name = 'SolidisCommandError';
}

export class SolidisConnectionError extends SolidisError {
  public name = 'SolidisConnectionError';
}

export class SolidisParserError extends SolidisError {
  public name = 'SolidisParserError';
}

export class SolidisPubSubError extends SolidisError {
  public name = 'SolidisPubSubError';
}

export class SolidisRequesterError extends SolidisError {
  public name = 'SolidisRequesterError';
}

export function wrapWithError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function wrapWithSolidisClientError(error: unknown): SolidisClientError {
  return wrapWithSolidisError(SolidisClientError, error);
}

export function wrapWithSolidisConnectionError(
  error: unknown,
): SolidisConnectionError {
  return wrapWithSolidisError(SolidisConnectionError, error);
}

export function wrapWithParserError(error: unknown): SolidisParserError {
  return wrapWithSolidisError(SolidisParserError, error);
}

export function wrapWithSolidisRequesterError(
  error: unknown,
): SolidisRequesterError {
  return wrapWithSolidisError(SolidisRequesterError, error);
}

export function unwrapSolidisError(error: unknown): Error[] {
  const errors: Error[] = [];

  let current = error;

  while (current instanceof Error && !errors.includes(current)) {
    errors.push(current);

    current = current.cause;
  }

  return errors;
}
