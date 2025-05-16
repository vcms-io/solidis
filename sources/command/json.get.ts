import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

import type { CommandJsonGetOptions } from '../index.ts';

export function createCommand(key: string, options?: CommandJsonGetOptions) {
  const command = ['JSON.GET', key];

  if (options) {
    if (options.indent !== undefined) {
      command.push('INDENT', options.indent);
    }

    if (options.newline !== undefined) {
      command.push('NEWLINE', options.newline);
    }

    if (options.space !== undefined) {
      command.push('SPACE', options.space);
    }

    if (options.path?.length) {
      command.push(...options.path);
    }
  }

  return command;
}

export async function jsonGet<T>(
  this: T,
  key: string,
  options?: CommandJsonGetOptions,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(key, options),
    tryReplyToStringOrNull,
  );
}
