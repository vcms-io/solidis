import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

import type { RespCommandListFilter } from '../index.ts';

export function createCommand(filter?: RespCommandListFilter) {
  const command = ['COMMAND', 'LIST'];

  if (filter?.module) {
    command.push('FILTERBY', 'MODULE', filter.module);
  }

  if (filter?.aclcat) {
    command.push('FILTERBY', 'ACLCAT', filter.aclcat);
  }

  if (filter?.pattern) {
    command.push('FILTERBY', 'PATTERN', filter.pattern);
  }

  return command;
}

export async function commandList<T>(
  this: T,
  filter?: RespCommandListFilter,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(filter),
    tryReplyToStringArray,
  );
}
