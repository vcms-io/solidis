import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  tryReplyToModuleInfo,
} from './utils/index.ts';

import type { RespModuleInfo } from '../index.ts';

export function createCommand() {
  return ['MODULE', 'LIST'];
}

export async function moduleList<T>(this: T): Promise<RespModuleInfo[]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (!Array.isArray(reply)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    }

    return reply.map(tryReplyToModuleInfo);
  });
}
