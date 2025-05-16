import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(
  key: string,
  groupname: string,
  consumername: string,
) {
  return ['XGROUP', 'DELCONSUMER', key, groupname, consumername];
}

export async function xgroupDelconsumer<T>(
  this: T,
  key: string,
  groupname: string,
  consumername: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, groupname, consumername),
    tryReplyNumber,
  );
}
