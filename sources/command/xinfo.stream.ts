import {
  executeCommand,
  tryReplyArray,
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
      command.push('COUNT', `${count}`);
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
    seenTime: Number(result.get('seen-time')),
    activeTime: tryReplyToNumberOrNull(
      result.get('active-time') ?? null,
      command,
    ),
    pelCount: Number(result.get('pel-count')),
    pending: tryReplyArray(result.get('pending'), command).map(
      (entry): RespStreamConsumerPending => {
        const [id, deliveryTime, deliveryCount] = tryReplyTuple(
          entry,
          3,
          command,
        );

        return {
          id: String(id),
          deliveryTime: Number(deliveryTime),
          deliveryCount: Number(deliveryCount),
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
    pelCount: Number(result.get('pel-count')),
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
          deliveryTime: Number(deliveryTime),
          deliveryCount: Number(deliveryCount),
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
  full?: boolean,
  count?: number,
): Promise<RespStreamInfo | RespStreamInfoFull> {
  return await executeCommand(
    this,
    createCommand(key, full, count),
    (reply, command) => {
      const result = tryReplyToMap(reply, command);

      const baseInformation = {
        length: Number(result.get('length')),
        radixTreeKeys: Number(result.get('radix-tree-keys')),
        radixTreeNodes: Number(result.get('radix-tree-nodes')),
        lastGeneratedId: String(result.get('last-generated-id')),
        maxDeletedEntryId: tryReplyToStringOrNull(
          result.get('max-deleted-entry-id') ?? null,
          command,
        ),
        entriesAdded: tryReplyToNumberOrNull(
          result.get('entries-added') ?? null,
          command,
        ),
        firstEntry: null,
        lastEntry: null,
        groups: Number(result.get('groups')),
      };

      if (!full) {
        const firstEntry = result.get('first-entry');
        const lastEntry = result.get('last-entry');

        return {
          ...baseInformation,
          firstEntry: firstEntry
            ? tryReplyToStreamEntry(firstEntry, command)
            : null,
          lastEntry: lastEntry
            ? tryReplyToStreamEntry(lastEntry, command)
            : null,
        };
      }

      return {
        ...baseInformation,
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
