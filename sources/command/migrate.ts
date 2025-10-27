import { RespNoKey } from '../index.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandMigrateOptions, RespOK } from '../index.ts';

export function createCommand(
  host: string,
  port: number,
  key: string,
  destinationDb: number,
  timeout: number,
  options?: CommandMigrateOptions,
) {
  const command = [
    'MIGRATE',
    host,
    `${port}`,
    key,
    `${destinationDb}`,
    `${timeout}`,
  ];

  if (options) {
    if (options.copy) {
      command.push('COPY');
    }

    if (options.replace) {
      command.push('REPLACE');
    }

    if (options.auth !== undefined) {
      command.push('AUTH', options.auth);
    }

    if (options.auth2 !== undefined) {
      command.push('AUTH2', options.auth2.username, options.auth2.password);
    }

    if (options.keys?.length) {
      command.push('KEYS', ...options.keys);
    }
  }

  return command;
}

export async function migrate<T>(
  this: T,
  host: string,
  port: number,
  key: string,
  destinationDb: number,
  timeout: number,
  options?: CommandMigrateOptions,
): Promise<RespOK | RespNoKey> {
  return await executeCommand(
    this,
    createCommand(host, port, key, destinationDb, timeout, options),
    (reply, command) => {
      if (reply === RespNoKey) {
        return reply;
      }

      return tryReplyOK(reply, command);
    },
  );
}
