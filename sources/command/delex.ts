import {
  appendValueConditionOptions,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandDelExOptions, StringOrBuffer } from '../index.ts';

export function createCommand(key: string, options?: CommandDelExOptions) {
  const command: StringOrBuffer[] = ['DELEX', key];

  if (options) {
    appendValueConditionOptions(
      command,
      options.ifValueEquals,
      options.ifValueNotEquals,
      options.ifDigestEquals,
      options.ifDigestNotEquals,
    );
  }

  return command;
}

export async function delex<T>(
  this: T,
  key: string,
  options?: CommandDelExOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, options),
    tryReplyNumber,
  );
}
