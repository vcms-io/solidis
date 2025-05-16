import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  key: string,
  groupname: string,
  id: string,
  mkstream?: boolean,
  entriesRead?: number,
) {
  const command = ['XGROUP', 'CREATE', key, groupname, id];

  if (mkstream) {
    command.push('MKSTREAM');
  }

  if (entriesRead !== undefined) {
    command.push('ENTRIESREAD', `${entriesRead}`);
  }

  return command;
}

export async function xgroupCreate<T>(
  this: T,
  key: string,
  groupname: string,
  id: string,
  mkstream?: boolean,
  entriesRead?: number,
) {
  return await executeCommand(
    this,
    createCommand(key, groupname, id, mkstream, entriesRead),
    tryReplyOK,
  );
}
