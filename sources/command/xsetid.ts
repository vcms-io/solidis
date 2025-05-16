import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  key: string,
  lastId: string,
  entriesAdded?: number,
  maxDeletedId?: string,
) {
  const command = ['XSETID', key, lastId];

  if (entriesAdded !== undefined) {
    command.push('ENTRIESADDED', `${entriesAdded}`);
  }

  if (maxDeletedId !== undefined) {
    command.push('MAXDELETEDID', maxDeletedId);
  }

  return command;
}

export async function xsetid<T>(
  this: T,
  key: string,
  lastId: string,
  entriesAdded?: number,
  maxDeletedId?: string,
) {
  return await executeCommand(
    this,
    createCommand(key, lastId, entriesAdded, maxDeletedId),
    tryReplyOK,
  );
}
