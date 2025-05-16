import { executeCommand } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(subcommand: string, ...parameters: string[]) {
  return ['DEBUG', subcommand, ...parameters];
}

export async function debug<T>(
  this: T,
  subcommand: string,
  ...parameters: string[]
): Promise<SolidisData> {
  return await executeCommand(this, createCommand(subcommand, ...parameters));
}
