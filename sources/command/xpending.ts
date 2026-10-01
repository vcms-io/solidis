import { executeCommand, tryReplyArray, tryReplyTuple } from './utils/index.ts';

import type {
  RespStreamPendingEntry,
  RespStreamPendingInfo,
} from '../index.ts';

export function createCommand(
  key: string,
  group: string,
  start?: string,
  end?: string,
  count?: number,
  consumer?: string,
  idleTime?: number,
) {
  const command = ['XPENDING', key, group];

  if (start !== undefined) {
    if (idleTime !== undefined) {
      command.push('IDLE', `${idleTime}`);
    }

    command.push(start, end ?? '+', `${count ?? 10}`);

    if (consumer !== undefined) {
      command.push(consumer);
    }
  }

  return command;
}

export async function xpending<T>(
  this: T,
  key: string,
  group: string,
  start?: string,
  end?: string,
  count?: number,
  consumer?: string,
  idleTime?: number,
): Promise<RespStreamPendingInfo | RespStreamPendingEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, group, start, end, count, consumer, idleTime),
    (reply, command) => {
      if (start !== undefined) {
        return tryReplyArray(reply, command).map(
          (entry): RespStreamPendingEntry => {
            const [id, owner, deliveryTime, deliveryCount] = tryReplyTuple(
              entry,
              4,
              command,
            );

            return {
              id: String(id),
              consumer: String(owner),
              deliveryTime: Number(deliveryTime),
              deliveryCount: Number(deliveryCount),
            };
          },
        );
      }

      const [pending, minId, maxId, consumers] = tryReplyTuple(
        reply,
        4,
        command,
      );

      return {
        pending: Number(pending),
        minId: minId === null ? null : String(minId),
        maxId: maxId === null ? null : String(maxId),
        consumers:
          consumers === null
            ? []
            : tryReplyArray(consumers, command).map((entry) => {
                const [name, total] = tryReplyTuple(entry, 2, command);

                return { name: String(name), count: Number(total) };
              }),
      };
    },
  );
}
