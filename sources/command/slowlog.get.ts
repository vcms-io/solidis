import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToString,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { RespSlowLogEntry } from '../index.ts';

export function createCommand(count?: number) {
  const command = ['SLOWLOG', 'GET'];

  if (count !== undefined) {
    command.push(formatInteger(count));
  }

  return command;
}

export async function slowlogGet<T>(
  this: T,
  count?: number,
): Promise<RespSlowLogEntry[]> {
  return await executeCommand(this, createCommand(count), (reply, command) =>
    tryReplyArray(reply, command).map((log) => {
      const [
        id,
        timestamp,
        duration,
        commandArguments,
        clientIpPort,
        clientName,
      ] = tryReplyArray(log, command);

      return {
        id: tryReplyNumber(id, command),
        timestamp: tryReplyNumber(timestamp, command),
        duration: tryReplyNumber(duration, command),
        commandArguments: tryReplyToStringArray(commandArguments, command),
        clientIpPort: tryReplyToString(clientIpPort, command),
        clientName: tryReplyToString(clientName, command),
      };
    }),
  );
}
