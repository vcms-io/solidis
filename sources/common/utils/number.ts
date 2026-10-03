import {
  SolidisInfinityText,
  SolidisNegativeInfinityText,
  SolidisNotANumberText,
} from '../internal.ts';

export function parseDouble(text: string): number | undefined {
  if (text === SolidisInfinityText) {
    return Number.POSITIVE_INFINITY;
  }

  if (text === SolidisNegativeInfinityText) {
    return Number.NEGATIVE_INFINITY;
  }

  const value = Number(text);

  if (
    !text ||
    (Number.isNaN(value) &&
      text.toLowerCase().replace(/^-/, '') !== SolidisNotANumberText)
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
