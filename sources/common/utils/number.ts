import {
  SolidisInfinityText,
  SolidisNegativeInfinityText,
  SolidisNotANumberText,
} from '../internal.ts';

export function parseDouble(text: string): number | undefined {
  const value = Number(text.replace(SolidisInfinityText, 'Infinity'));

  if (
    !text ||
    /[\sbox]/i.test(text) ||
    (Number.isNaN(value) && !/^-?nan$/i.test(text))
  ) {
    return undefined;
  }

  return value;
}

export function formatDouble(value: number): string {
  if (Number.isNaN(value)) {
    return SolidisNotANumberText;
  }

  if (value === Number.POSITIVE_INFINITY) {
    return SolidisInfinityText;
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return SolidisNegativeInfinityText;
  }

  return `${value}`;
}
