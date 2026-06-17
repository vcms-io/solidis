import { en } from './en.ts';
import { ko } from './ko.ts';

import type { BenchmarkLocale } from './types.ts';

const LOCALE_MAP: Record<string, BenchmarkLocale> = {
  ko,
};

const LANG_CODE_PATTERN = /\.([a-z]{2}(?:-[a-z]{2})?)\.md$/i;

export function resolveLocale(filename: string): BenchmarkLocale {
  const match = LANG_CODE_PATTERN.exec(filename);

  if (!match) {
    return en;
  }

  const code = match[1].toLowerCase();

  return LOCALE_MAP[code] ?? en;
}

export { en } from './en.ts';

export type { BenchmarkLocale } from './types.ts';
