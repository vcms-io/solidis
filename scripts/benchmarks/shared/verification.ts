import { inspect } from 'node:util';

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

function toDisplayString(value: unknown): string {
  if (Buffer.isBuffer(value)) {
    return `Buffer(${value.length})`;
  }

  return inspect(value, { depth: 1, maxStringLength: 64 });
}

export function assertOk(value: unknown, label: string): void {
  const text = Buffer.isBuffer(value) ? value.toString() : String(value);

  if (text !== 'OK') {
    throw new VerificationError(
      `${label}: expected OK, got ${toDisplayString(value)}`,
    );
  }
}

export function assertBufferEquals(
  value: unknown,
  expected: Buffer,
  label: string,
): void {
  if (!Buffer.isBuffer(value)) {
    throw new VerificationError(
      `${label}: expected Buffer, got ${toDisplayString(value)}`,
    );
  }

  if (!value.equals(expected)) {
    throw new VerificationError(
      `${label}: buffer mismatch (got ${value.length} bytes, expected ${expected.length} bytes)`,
    );
  }
}

export function assertInteger(value: unknown, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new VerificationError(
      `${label}: expected integer, got ${toDisplayString(value)}`,
    );
  }

  return parsed;
}

export function assertIntegerEquals(
  value: unknown,
  expected: number,
  label: string,
): void {
  const parsed = assertInteger(value, label);

  if (parsed !== expected) {
    throw new VerificationError(
      `${label}: expected ${expected}, got ${parsed}`,
    );
  }
}

export function assertArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new VerificationError(
      `${label}: expected array, got ${toDisplayString(value)}`,
    );
  }

  return value;
}

export function assertArrayMinLength(
  value: unknown,
  minLength: number,
  label: string,
): unknown[] {
  const elements = assertArray(value, label);

  if (elements.length < minLength) {
    throw new VerificationError(
      `${label}: expected array with at least ${minLength} elements, got ${elements.length}`,
    );
  }

  return elements;
}

export function assertArrayLength(
  value: unknown,
  expectedLength: number,
  label: string,
): unknown[] {
  const elements = assertArray(value, label);

  if (elements.length !== expectedLength) {
    throw new VerificationError(
      `${label}: expected array with ${expectedLength} elements, got ${elements.length}`,
    );
  }

  return elements;
}

export function assertNonNull(value: unknown, label: string): void {
  if (value === null || value === undefined) {
    throw new VerificationError(`${label}: expected non-null, got ${value}`);
  }
}

export function assertHashContains(
  hgetallResult: unknown,
  field: string,
  expectedValue: Buffer,
  label: string,
): void {
  if (hgetallResult === null || hgetallResult === undefined) {
    throw new VerificationError(
      `${label}: expected hash, got ${hgetallResult}`,
    );
  }

  if (Array.isArray(hgetallResult)) {
    for (let index = 0; index < hgetallResult.length; index += 2) {
      const key = Buffer.isBuffer(hgetallResult[index])
        ? hgetallResult[index].toString()
        : String(hgetallResult[index]);

      if (key === field) {
        assertBufferEquals(
          hgetallResult[index + 1],
          expectedValue,
          `${label}[${field}]`,
        );

        return;
      }
    }

    throw new VerificationError(
      `${label}: field '${field}' not found in array of ${hgetallResult.length} elements`,
    );
  }

  if (typeof hgetallResult === 'object') {
    const value = Reflect.get(hgetallResult, field);

    if (value === undefined) {
      throw new VerificationError(
        `${label}: field '${field}' not found in object`,
      );
    }

    assertBufferEquals(value, expectedValue, `${label}[${field}]`);

    return;
  }

  throw new VerificationError(
    `${label}: expected array or object, got ${toDisplayString(hgetallResult)}`,
  );
}
