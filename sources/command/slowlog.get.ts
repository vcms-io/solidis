import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespSlowLogEntry } from '../index.ts';

export function createCommand(count?: number) {
  const command = ['SLOWLOG', 'GET'];

  if (count !== undefined) {
    command.push(`${count}`);
  }

  return command;
}

export async function slowlogGet<T>(
  this: T,
  count?: number,
): Promise<RespSlowLogEntry[]> {
  return await executeCommand(this, createCommand(count), (reply, command) => {
    if (!Array.isArray(reply)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    }

    return reply.map((log) => {
      if (!Array.isArray(log) || log.length < 6) {
        throw newCommandError(`${InvalidReplyPrefix}: ${log}`, command);
      }

      const [
        id,
        timestamp,
        duration,
        commandArguments,
        clientIpPort,
        clientName,
      ] = log;

      if (
        typeof id !== 'number' ||
        typeof timestamp !== 'number' ||
        typeof duration !== 'number' ||
        !Array.isArray(commandArguments) ||
        (typeof clientIpPort !== 'string' &&
          !(clientIpPort instanceof Buffer)) ||
        (typeof clientName !== 'string' && !(clientName instanceof Buffer))
      ) {
        throw newCommandError(`${InvalidReplyPrefix}: ${log}`, command);
      }

      return {
        id,
        timestamp,
        duration,
        commandArguments: commandArguments.map((argument) =>
          typeof argument === 'string' || argument instanceof Buffer
            ? `${argument}`
            : String(argument),
        ),
        clientIpPort: `${clientIpPort}`,
        clientName: `${clientName}`,
      };
    });
  });
}
