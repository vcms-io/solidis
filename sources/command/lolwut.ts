import { appendItems, formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(
  version?: number,
  ...optionalArguments: string[]
) {
  const command = ['LOLWUT'];

  if (version !== undefined) {
    command.push('VERSION', formatInteger(version));
  }

  return [...command, ...optionalArguments];
}

export async function lolwut<T>(
  this: T,
  version?: number,
  ...optionalArguments: string[]
): Promise<string> {
  return await executeCommand(
    this,
    appendItems(createCommand(version), optionalArguments),
    tryReplyToString,
  );
}
