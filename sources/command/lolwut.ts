import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(
  version?: number,
  ...optionalArguments: string[]
) {
  const command = ['LOLWUT'];

  if (version !== undefined) {
    command.push('VERSION', `${version}`);
  }

  if (optionalArguments.length) {
    command.push(...optionalArguments);
  }

  return command;
}

export async function lolwut<T>(
  this: T,
  version?: number,
  ...optionalArguments: string[]
): Promise<string> {
  return await executeCommand(
    this,
    createCommand(version, ...optionalArguments),
    tryReplyToString,
  );
}
