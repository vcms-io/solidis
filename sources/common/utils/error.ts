export class RespError extends Error {
  constructor(message: string) {
    super(message);

    this.stack = undefined;
    this.name = 'RespError';
  }
}

export class SolidisError extends Error {
  #originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);

    this.name = 'SolidisError';

    this.#originalError = originalError;

    if (originalError instanceof Error) {
      this.stack = originalError.stack;
      this.cause = originalError.cause;
    }
  }

  public getOriginalError(): unknown {
    return this.#originalError;
  }
}

export class SolidisClientError extends SolidisError {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);

    this.name = 'SolidisClientError';
  }
}

export class SolidisCommandError extends SolidisError {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);

    this.name = 'SolidisCommandError';
  }
}

export class SolidisConnectionError extends SolidisError {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);

    this.name = 'SolidisConnectionError';
  }
}

export class SolidisParserError extends SolidisError {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);

    this.name = 'SolidisParserError';
  }
}

export class SolidisPubSubError extends SolidisError {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);

    this.name = 'SolidisPubSubError';
  }
}

export class SolidisRequesterError extends SolidisError {
  constructor(message: string, originalError?: unknown) {
    super(message, originalError);

    this.name = 'SolidisRequesterError';
  }
}

export function wrapWithError(error: unknown): Error {
  return error instanceof Error ? error : new Error(`${error}`);
}

function wrapWithSolidisError<T extends SolidisError>(
  ErrorClass: new (message: string, originalError?: unknown) => T,
  error: unknown,
): T {
  return error instanceof ErrorClass
    ? error
    : new ErrorClass(`${error}`, error);
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

  if (error instanceof Error) {
    errors.push(error);
  }

  if (error instanceof SolidisError) {
    const originalError = error.getOriginalError();

    errors.push(...unwrapSolidisError(originalError));
  }

  return errors;
}
