import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  processPairedArray,
  tryReplyToNumber,
  tryReplyToString,
} from './utils/index.ts';

import { SolidisCommandError } from '../index.ts';

import type {
  RespAclLogEntry,
  RespAclLogKey,
  RespAclLogNumberKey,
} from '../index.ts';

const checkAclLogKey = (key: string): key is RespAclLogKey => {
  return [
    'count',
    'reason',
    'context',
    'object',
    'username',
    'age-seconds',
    'client-info',
    'entry-id',
    'timestamp-created',
    'timestamp-last-updated',
  ].includes(key);
};

const checkAclLogNumberKey = (
  resultKey: keyof RespAclLogEntry,
): resultKey is RespAclLogNumberKey => {
  return [
    'count',
    'ageSeconds',
    'entryId',
    'timestampCreated',
    'timestampLastUpdated',
  ].includes(resultKey);
};

const logKeyToResultKeyMap = {
  count: 'count',
  reason: 'reason',
  context: 'context',
  object: 'object',
  username: 'username',
  'age-seconds': 'ageSeconds',
  'client-info': 'clientInfo',
  'entry-id': 'entryId',
  'timestamp-created': 'timestampCreated',
  'timestamp-last-updated': 'timestampLastUpdated',
} as const;

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
    if (!Array.isArray(reply)) {
      throw new SolidisCommandError(
        `${UnexpectedReplyPrefix}: ${reply}`,
        command,
      );
    }

    return reply.map((entry) => {
      const result: RespAclLogEntry = {
        count: 0,
        reason: '',
        context: '',
        object: '',
        username: '',
        ageSeconds: 0,
        clientInfo: '',
        entryId: 0,
        timestampCreated: 0,
        timestampLastUpdated: 0,
      };

      processPairedArray(
        entry,
        (key, value) => {
          const logKey = key.toLowerCase();

          if (!checkAclLogKey(logKey)) {
            throw new SolidisCommandError(
              `${InvalidReplyPrefix}: ${logKey}`,
              command,
            );
          }

          const resultKey = logKeyToResultKeyMap[logKey];

          if (checkAclLogNumberKey(resultKey)) {
            result[resultKey] = tryReplyToNumber(value);
            return;
          }

          result[resultKey] = tryReplyToString(value);
        },
        command,
      );

      return result;
    });
  });
}
