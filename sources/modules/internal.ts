import { SolidisSubscriptionEventNames } from '../common/constants.ts';
import { SolidisCommandKindCacheLimit } from '../common/internal.ts';
import { SolidisRequesterError } from '../common/utils/error.ts';
import { isStringOrBuffer, toTextPrefix } from '../common/utils/internal.ts';
import { isSubscriptionEventName } from '../common/utils/reply.ts';
import { getCommandName } from '../common/utils/request.ts';

import type { SolidisCommandKind } from '../types/internal.ts';
import type { SolidisSendOptions, StringOrBuffer } from '../types/solidis.ts';

export { EventEmitter, errorMonitor } from 'node:events';

export const SolidisSessionSendOptions: SolidisSendOptions = {};

export function copyCommands(commands: readonly (readonly StringOrBuffer[])[]) {
  return Array.isArray(commands)
    ? commands.map((command) =>
        Array.isArray(command) ? command.slice() : command,
      )
    : [commands];
}

export const SolidisSessionCommandKinds = [
  'select',
  'hello',
  'auth',
  'reset',
  'watch',
  'unwatch',
  'multi',
  'exec',
  'discard',
] as const;

export const SolidisUnsupportedCommandNameSet: ReadonlySet<string> = new Set([
  'MONITOR',
  'SYNC',
  'PSYNC',
  'CLIENT REPLY OFF',
  'CLIENT REPLY SKIP',
  'SCRIPT DEBUG YES',
  'SCRIPT DEBUG SYNC',
  'REPLCONF ACK',
  'REPLCONF GETACK',
  'CLUSTER SYNCSLOTS',
]);

export const SolidisCommandKinds: ReadonlyMap<string, SolidisCommandKind> =
  new Map<string, SolidisCommandKind>([
    ...[...SolidisSubscriptionEventNames, ...SolidisSessionCommandKinds].map(
      (kind) => [kind.toUpperCase(), kind] as const,
    ),
    ...[...SolidisUnsupportedCommandNameSet].map(
      (name) => [name.split(' ')[0], 'restricted'] as const,
    ),
  ]);

export const SolidisPairingReason =
  'it breaks the pairing of requests and replies.';

const commandKindCache = new Map<string, SolidisCommandKind | null>();

export function toCommandWord(text: string) {
  return text.split('\0', 1)[0].toUpperCase();
}

function classifyCommand(command: StringOrBuffer[]) {
  const text = toTextPrefix(command[0], 32);

  let kind = commandKindCache.get(text);

  if (kind === undefined) {
    kind = SolidisCommandKinds.get(toCommandWord(text)) ?? null;

    if (commandKindCache.size < SolidisCommandKindCacheLimit) {
      commandKindCache.set(text, kind);
    }
  }

  return kind;
}

function isUnsupported(command: StringOrBuffer[]) {
  const words = command.map((word) => toCommandWord(toTextPrefix(word, 16)));

  return words.some((word, index) =>
    SolidisUnsupportedCommandNameSet.has(
      index % 2
        ? `${words[0]} ${word}`
        : words.slice(0, Math.min(index + 1, 3)).join(' '),
    ),
  );
}

function hasWrongDigestLength(command: StringOrBuffer[]) {
  if (
    command.length < 6 ||
    toCommandWord(toTextPrefix(command[0], 4)) !== 'SET'
  ) {
    return false;
  }

  const words = command.map((word) => toCommandWord(toTextPrefix(word, 16)));
  const index = words.indexOf('IFDEQ', 3) + 1 || words.indexOf('IFDNE', 3) + 1;

  return (
    index > 0 &&
    words.includes('GET', 3) &&
    Buffer.byteLength(command[index] ?? '') !== 16
  );
}

export function createRefusal(command: StringOrBuffer[], reason: string) {
  return new SolidisRequesterError(`${getCommandName(command)} ${reason}`);
}

export function inspectCommand(
  command: StringOrBuffer[],
  isQueueing?: boolean,
  index = 0,
) {
  if (!Array.isArray(command) || !command.length) {
    return new SolidisRequesterError(
      'Cannot send an empty or non-array command.',
    );
  }

  for (const argument of command) {
    if (!isStringOrBuffer(argument)) {
      return createRefusal(command, 'takes only strings and Buffers.');
    }
  }

  const kind = classifyCommand(command);

  if (kind === 'restricted' && isUnsupported(command)) {
    return createRefusal(command, `is not supported: ${SolidisPairingReason}`);
  }

  if (hasWrongDigestLength(command)) {
    return createRefusal(
      command,
      `with GET needs 16-byte digests: ${SolidisPairingReason}`,
    );
  }

  const isAuthentication = kind === 'auth' || kind === 'hello';

  if (isQueueing && (isSubscriptionEventName(kind) || isAuthentication)) {
    return createRefusal(
      command,
      `is not supported inside a transaction: ${SolidisPairingReason}`,
    );
  }

  return index && isAuthentication
    ? createRefusal(
        command,
        `must come first in a batch: ${SolidisPairingReason}`,
      )
    : kind;
}
