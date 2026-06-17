import type { BenchmarkMode, Command } from '../shared/types.ts';

export function getComparableModes(
  _commands: Command[],
): ReadonlySet<BenchmarkMode> {
  return new Set(['batch', 'autopipeline']);
}

export function getNonComparableReason(
  _commands: Command[],
): string | undefined {
  return undefined;
}
