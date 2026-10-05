import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToMap,
  tryReplyToNumberOrNull,
  tryReplyToStreamEntries,
  tryReplyToStreamEntry,
  tryReplyToStringOrNull,
  tryReplyTuple,
} from './utils/index.ts';

import type {
  RespStreamConsumerPending,
  RespStreamGroupConsumer,
  RespStreamGroupDetail,
  RespStreamGroupPending,
  RespStreamInfo,
  RespStreamInfoFull,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(key: string, full?: boolean, count?: number) {
  const command = ['XINFO', 'STREAM', key];

  if (full) {
    command.push('FULL');

    if (count !== undefined) {
      command.push('COUNT', formatInteger(count));
    }
  }

  return command;
}

function parseConsumer(
  info: unknown,
  command: StringOrBuffer[],
): RespStreamGroupConsumer {
  const result = tryReplyToMap(info, command);

  return {
    name: String(result.get('name')),
    seenTime: tryReplyNumber(result.get('seen-time'), command),
    activeTime: tryReplyToNumberOrNull(
      result.get('active-time') ?? null,
      command,
    ),
    pelCount: tryReplyNumber(result.get('pel-count'), command),
    pending: tryReplyArray(result.get('pending'), command).map(
      (entry): RespStreamConsumerPending => {
        const [id, deliveryTime, deliveryCount] = tryReplyTuple(
          entry,
          3,
          command,
        );

        return {
          id: String(id),
          deliveryTime: tryReplyNumber(deliveryTime, command),
          deliveryCount: tryReplyNumber(deliveryCount, command),
        };
      },
    ),
  };
}

function parseGroup(
  info: unknown,
  command: StringOrBuffer[],
): RespStreamGroupDetail {
  const result = tryReplyToMap(info, command);

  return {
    name: String(result.get('name')),
    lastDeliveredId: String(result.get('last-delivered-id')),
    entriesRead: tryReplyToNumberOrNull(
      result.get('entries-read') ?? null,
      command,
    ),
    lag: tryReplyToNumberOrNull(result.get('lag') ?? null, command),
    pelCount: tryReplyNumber(result.get('pel-count'), command),
    pending: tryReplyArray(result.get('pending'), command).map(
      (entry): RespStreamGroupPending => {
        const [id, consumer, deliveryTime, deliveryCount] = tryReplyTuple(
          entry,
          4,
          command,
        );

        return {
          id: String(id),
          consumer: String(consumer),
          deliveryTime: tryReplyNumber(deliveryTime, command),
          deliveryCount: tryReplyNumber(deliveryCount, command),
        };
      },
    ),
    consumers: tryReplyArray(result.get('consumers'), command).map((consumer) =>
      parseConsumer(consumer, command),
    ),
  };
}

export async function xinfoStream<T>(
  this: T,
  key: string,
  full?: false,
): Promise<RespStreamInfo>;
export async function xinfoStream<T>(
  this: T,
  key: string,
  full: true,
  count?: number,
): Promise<RespStreamInfoFull>;
export async function xinfoStream<T>(
  this: T,
  key: string,
  ...parameters: [full?: boolean] | [full: true, count?: number]
): Promise<RespStreamInfo | RespStreamInfoFull>;
export async function xinfoStream<T>(
  this: T,
  key: string,
  full?: boolean,
  count?: number,
): Promise<RespStreamInfo | RespStreamInfoFull> {
  return await executeCommand(
    this,
    createCommand(key, full, count),
    (reply, command) => {
      const result = tryReplyToMap(reply, command);

      const information = {
        length: tryReplyNumber(result.get('length'), command),
        radixTreeKeys: tryReplyNumber(result.get('radix-tree-keys'), command),
        radixTreeNodes: tryReplyNumber(result.get('radix-tree-nodes'), command),
        lastGeneratedId: String(result.get('last-generated-id')),
        maxDeletedEntryId: tryReplyToStringOrNull(
          result.get('max-deleted-entry-id') ?? null,
          command,
        ),
        entriesAdded: tryReplyToNumberOrNull(
          result.get('entries-added') ?? null,
          command,
        ),
      };

      if (!full) {
        const firstEntry = result.get('first-entry');
        const lastEntry = result.get('last-entry');

        return {
          ...information,
          firstEntry: firstEntry
            ? tryReplyToStreamEntry(firstEntry, command)
            : null,
          lastEntry: lastEntry
            ? tryReplyToStreamEntry(lastEntry, command)
            : null,
          groups: tryReplyNumber(result.get('groups'), command),
        };
      }

      return {
        ...information,
        recordedFirstEntryId: tryReplyToStringOrNull(
          result.get('recorded-first-entry-id') ?? null,
          command,
        ),
        entries: tryReplyToStreamEntries(result.get('entries'), command),
        groups: tryReplyArray(result.get('groups'), command).map((group) =>
          parseGroup(group, command),
        ),
      };
    },
  );
}
