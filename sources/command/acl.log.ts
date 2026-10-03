import {
  executeCommand,
  processPairedArray,
  tryReplyArray,
  tryReplyToNumber,
  tryReplyToString,
} from './utils/index.ts';

import type { RespAclLogEntry } from '../index.ts';

export function createCommand(count?: number | 'RESET') {
  const command = ['ACL', 'LOG'];

  if (count !== undefined) {
    command.push(String(count));
  }

  return command;
}

export async function aclLog<T>(
  this: T,
  count?: number | 'RESET',
): Promise<RespAclLogEntry[]> {
  return await executeCommand(this, createCommand(count), (reply, command) => {
    if (count === 'RESET') {
      return [];
    }

    return tryReplyArray(reply, command).map((entry) => {
      const result: RespAclLogEntry = {
        count: 0,
        reason: '',
        context: '',
        object: '',
        username: '',
        ageSeconds: 0,
        clientInfo: '',
        entryId: null,
        timestampCreated: null,
        timestampLastUpdated: null,
      };

      processPairedArray(
        entry,
        (key, value) => {
          switch (key) {
            case 'count':
              result.count = tryReplyToNumber(value, command);
              break;
            case 'age-seconds':
              result.ageSeconds = tryReplyToNumber(value, command);
              break;
            case 'entry-id':
              result.entryId = tryReplyToNumber(value, command);
              break;
            case 'timestamp-created':
              result.timestampCreated = tryReplyToNumber(value, command);
              break;
            case 'timestamp-last-updated':
              result.timestampLastUpdated = tryReplyToNumber(value, command);
              break;
            case 'reason':
            case 'context':
            case 'object':
            case 'username':
              result[key] = tryReplyToString(value, command);
              break;
            case 'client-info':
              result.clientInfo = tryReplyToString(value, command);
              break;
          }
        },
        command,
      );

      return result;
    });
  });
}
