import { SolidisNumberTypes } from '../constants.ts';

export function parseDouble(text: string): number | undefined {
  switch (text) {
    case SolidisNumberTypes.INFINITY: {
      return Number.POSITIVE_INFINITY;
    }

    case SolidisNumberTypes.NEGATIVE_INFINITY: {
      return Number.NEGATIVE_INFINITY;
    }

    default: {
      break;
    }
  }

  const value = Number(text);

  if (
    text.length === 0 ||
    (Number.isNaN(value) &&
      text.toLowerCase().replace(/^-/, '') !== SolidisNumberTypes.NAN)
  ) {
    return undefined;
  }

  return value;
}

export function formatDouble(value: number): string {
  if (Number.isNaN(value)) {
    return SolidisNumberTypes.NAN;
  }

  if (value === Number.POSITIVE_INFINITY) {
    return SolidisNumberTypes.INFINITY;
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return SolidisNumberTypes.NEGATIVE_INFINITY;
  }

  return `${value}`;
}
