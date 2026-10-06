import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToInteger,
  tryReplyTuple,
} from './utils/index.ts';

import type {
  CommandXpendingRange,
  RespStreamPendingEntry,
  RespStreamPendingInfo,
} from '../index.ts';

export function createCommand(
  key: string,
  group: string,
  ...range: [] | CommandXpendingRange
) {
  const command = ['XPENDING', key, group];

  if (range.length !== 0) {
    const [start, end, count, consumer, idleTime] = range;

    if (idleTime !== undefined) {
      command.push('IDLE', formatInteger(idleTime));
    }

    command.push(start, end, formatInteger(count));

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
): Promise<RespStreamPendingInfo>;
export async function xpending<T>(
  this: T,
  key: string,
  group: string,
  ...range: CommandXpendingRange
): Promise<RespStreamPendingEntry[]>;
export async function xpending<T>(
  this: T,
  key: string,
  group: string,
  ...range: [] | CommandXpendingRange
): Promise<RespStreamPendingInfo | RespStreamPendingEntry[]>;
export async function xpending<T>(
  this: T,
  key: string,
  group: string,
  ...range: [] | CommandXpendingRange
): Promise<RespStreamPendingInfo | RespStreamPendingEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, group, ...range),
    (reply, command) => {
      if (range.length !== 0) {
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
              deliveryTime: tryReplyNumber(deliveryTime, command),
              deliveryCount: tryReplyNumber(deliveryCount, command),
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
        pending: tryReplyNumber(pending, command),
        minId: minId === null ? null : String(minId),
        maxId: maxId === null ? null : String(maxId),
        consumers:
          consumers === null
            ? []
            : tryReplyArray(consumers, command).map((entry) => {
                const [name, total] = tryReplyTuple(entry, 2, command);

                return {
                  name: String(name),
                  count: tryReplyToInteger(total, command),
                };
              }),
      };
    },
  );
}
