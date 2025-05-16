import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  key: string,
  groupname: string,
  id: string,
  entriesRead?: number,
) {
  const command = ['XGROUP', 'SETID', key, groupname, id];

  if (entriesRead !== undefined) {
    command.push('ENTRIESREAD', `${entriesRead}`);
  }

  return command;
}

export async function xgroupSetid<T>(
  this: T,
  key: string,
  groupname: string,
  id: string,
  entriesRead?: number,
) {
  return await executeCommand(
    this,
    createCommand(key, groupname, id, entriesRead),
    tryReplyOK,
  );
}
