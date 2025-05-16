import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, groupname: string) {
  return ['XGROUP', 'DESTROY', key, groupname];
}

export async function xgroupDestroy<T>(
  this: T,
  key: string,
  groupname: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, groupname),
    tryReplyNumber,
  );
}
