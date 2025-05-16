import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(command: string, parameters: string[]) {
  return ['COMMAND', 'GETKEYS', command, ...parameters];
}

export async function commandGetkeys<T>(
  this: T,
  command: string,
  parameters: string[],
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(command, parameters),
    tryReplyToStringArray,
  );
}
