import {
  SolidisInfinityText,
  SolidisNegativeInfinityText,
  SolidisNotANumberText,
} from '../internal.ts';

export function parseDouble(text: string): number | undefined {
  const value = Number(text.replace(SolidisInfinityText, 'Infinity'));

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
