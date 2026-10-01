import {
  executeCommand,
  tryReplyArray,
  tryReplyToModuleInfo,
} from './utils/index.ts';

import type { RespModuleInfo } from '../index.ts';

export function createCommand() {
  return ['MODULE', 'LIST'];
}

export async function moduleList<T>(this: T): Promise<RespModuleInfo[]> {
  return await executeCommand(this, createCommand(), (reply, command) =>
    tryReplyArray(reply, command).map(tryReplyToModuleInfo),
  );
}
