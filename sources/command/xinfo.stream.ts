import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyToMap,
  tryReplyToNumberOrNull,
  tryReplyToStreamEntry,
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

  const pending = result.get('pending');

  if (!Array.isArray(pending)) {
    throw newUnexpectedReplyError(pending, command);
  }

  return {
    name: String(result.get('name')),
    seenTime: Number(result.get('seen-time')),
    activeTime: Number(result.get('active-time')),
    pelCount: Number(result.get('pel-count')),
    pending: pending.map((entry): RespStreamConsumerPending => {
      if (!Array.isArray(entry) || entry.length !== 3) {
        throw newUnexpectedReplyError(entry, command);
      }

      const [id, deliveryTime, deliveryCount] = entry;

      return {
        id: String(id),
        deliveryTime: Number(deliveryTime),
        deliveryCount: Number(deliveryCount),
      };
    }),
  };
}

function parseGroup(
  info: unknown,
  command: StringOrBuffer[],
): RespStreamGroupDetail {
  const result = tryReplyToMap(info, command);

  const pending = result.get('pending');

  if (!Array.isArray(pending)) {
    throw newUnexpectedReplyError(pending, command);
  }

  const consumers = result.get('consumers');

  if (!Array.isArray(consumers)) {
    throw newUnexpectedReplyError(consumers, command);
  }

  return {
    name: String(result.get('name')),
    lastDeliveredId: String(result.get('last-delivered-id')),
    entriesRead: tryReplyToNumberOrNull(
      result.get('entries-read') ?? null,
      command,
    ),
    lag: tryReplyToNumberOrNull(result.get('lag') ?? null, command),
    pelCount: Number(result.get('pel-count')),
    pending: pending.map((entry): RespStreamGroupPending => {
      if (!Array.isArray(entry) || entry.length !== 4) {
        throw newUnexpectedReplyError(entry, command);
      }

      const [id, consumer, deliveryTime, deliveryCount] = entry;

      return {
        id: String(id),
        consumer: String(consumer),
        deliveryTime: Number(deliveryTime),
        deliveryCount: Number(deliveryCount),
      };
    }),
    consumers: consumers.map((consumer) => parseConsumer(consumer, command)),
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
        maxDeletedEntryId: String(result.get('max-deleted-entry-id')),
        entriesAdded: Number(result.get('entries-added')),
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

      const entries = result.get('entries');

      if (!Array.isArray(entries)) {
        throw newUnexpectedReplyError(entries, command);
      }

      const groups = result.get('groups');

      if (!Array.isArray(groups)) {
        throw newUnexpectedReplyError(groups, command);
      }

      return {
        ...baseInformation,
        recordedFirstEntryId: String(result.get('recorded-first-entry-id')),
        entries: entries.map((entry) => tryReplyToStreamEntry(entry, command)),
        groups: groups.map((group) => parseGroup(group, command)),
      };
    },
  );
}
