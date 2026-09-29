export class SolidisError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });

    this.name = 'SolidisError';
  }

  public getOriginalError(): unknown {
    return this.cause;
  }
}

export class RespError extends SolidisError {
  public readonly code: string;

  constructor(message: string) {
    super(message);

    const separatorIndex = message.indexOf(' ');

    this.name = 'RespError';
    this.stack = undefined;
    this.code =
      separatorIndex === -1 ? message : message.slice(0, separatorIndex);
  }
}

export class SolidisClientError extends SolidisError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);

    this.name = 'SolidisClientError';
  }
}

export class SolidisCommandError extends SolidisError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);

    this.name = 'SolidisCommandError';
  }
}

export class SolidisConnectionError extends SolidisError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);

    this.name = 'SolidisConnectionError';
  }
}

export class SolidisParserError extends SolidisError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);

    this.name = 'SolidisParserError';
  }
}

export class SolidisPubSubError extends SolidisError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);

    this.name = 'SolidisPubSubError';
  }
}

export class SolidisRequesterError extends SolidisError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);

    this.name = 'SolidisRequesterError';
  }
}

export function wrapWithError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function wrapWithSolidisError<T extends SolidisError>(
  ErrorClass: new (message: string, cause?: unknown) => T,
  error: unknown,
): T {
  if (error instanceof ErrorClass) {
    return error;
  }

  return new ErrorClass(
    error instanceof Error ? error.message : String(error),
    error,
  );
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
