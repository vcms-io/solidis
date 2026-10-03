import {
  SolidisInfinityText,
  SolidisNegativeInfinityText,
  SolidisNotANumberText,
} from '../internal.ts';

const INFINITY = SolidisInfinityText;
const NEGATIVE_INFINITY = SolidisNegativeInfinityText;
const NAN = SolidisNotANumberText;

export function parseDouble(text: string): number | undefined {
  if (text === INFINITY) {
    return Number.POSITIVE_INFINITY;
  }

  if (text === NEGATIVE_INFINITY) {
    return Number.NEGATIVE_INFINITY;
  }

  const value = Number(text);

  if (
    !text ||
    (Number.isNaN(value) && text.toLowerCase().replace(/^-/, '') !== NAN)
  ) {
    return undefined;
  }

  return value;
}

export function formatDouble(value: number): string {
  if (Number.isNaN(value)) {
    return NAN;
  }

  if (value === Number.POSITIVE_INFINITY) {
    return INFINITY;
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return NEGATIVE_INFINITY;
  }

  return `${value}`;
}
