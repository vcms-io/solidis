import { formatInteger } from '../common/utils/internal.ts';
import { RespNoKey } from '../types/resp.ts';
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
    formatInteger(port),
    key,
    formatInteger(destinationDb),
    formatInteger(timeout),
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
  }

  return options?.keys ? [...command, 'KEYS', ...options.keys] : command;
}

export async function migrate<T>(
  this: T,
  host: string,
  port: number,
  ...parameters:
    | [
        key: '',
        destinationDb: number,
        timeout: number,
        options: CommandMigrateOptions & { keys: string[] },
      ]
    | [
        key: string,
        destinationDb: number,
        timeout: number,
        options?: CommandMigrateOptions & { keys?: undefined },
      ]
): Promise<RespOK | RespNoKey> {
  const [key, destinationDb, timeout, options] = parameters;

  return await executeCommand(
    this,
    createCommand(host, port, key, destinationDb, timeout, options),
    (reply, command) => {
      if (reply === RespNoKey) {
        return reply;
      }

      return tryReplyOK(reply, command);
    },
    undefined,
    { blockingTimeout: timeout },
  );
}
