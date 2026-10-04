import { SolidisSubscriptionEventNames } from '../common/constants.ts';
import { SolidisCommandKindCacheLimit } from '../common/internal.ts';
import { SolidisRequesterError } from '../common/utils/error.ts';
import { toTextPrefix } from '../common/utils/internal.ts';
import { isSubscriptionEventName } from '../common/utils/reply.ts';
import { getCommandName } from '../common/utils/request.ts';

import type { SolidisCommandKind } from '../types/internal.ts';
import type { SolidisSendOptions, StringOrBuffer } from '../types/solidis.ts';

export { EventEmitter, errorMonitor } from 'node:events';

export const SolidisSessionSendOptions: SolidisSendOptions = {};

export function copyCommands(commands: StringOrBuffer[][]) {
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

function classifyCommand(command: StringOrBuffer[]) {
  const text = toTextPrefix(command[0], 32);

  let kind = commandKindCache.get(text);

  if (kind === undefined) {
    kind = SolidisCommandKinds.get(text.toUpperCase()) ?? null;

    if (commandKindCache.size < SolidisCommandKindCacheLimit) {
      commandKindCache.set(text, kind);
    }
  }

  return kind;
}

function isUnsupported(command: StringOrBuffer[]) {
  const words = command
    .slice(0, 3)
    .map((word) => toTextPrefix(word, 16).split('\0', 1)[0].toUpperCase());

  return [1, 2, 3].some((length) =>
    SolidisUnsupportedCommandNameSet.has(words.slice(0, length).join(' ')),
  );
}

export function createRefusal(command: StringOrBuffer[], reason: string) {
  return new SolidisRequesterError(`${getCommandName(command)} ${reason}`);
}

export function inspectCommand(
  command: StringOrBuffer[],
  isQueueing?: boolean,
) {
  if (!Array.isArray(command) || command.length === 0) {
    return new SolidisRequesterError(
      'Cannot send an empty or non-array command.',
    );
  }

  for (const argument of command) {
    if (typeof argument !== 'string' && !Buffer.isBuffer(argument)) {
      return createRefusal(command, 'takes only strings and Buffers.');
    }
  }

  const kind = classifyCommand(command);

  if (kind === 'restricted' && isUnsupported(command)) {
    return createRefusal(command, `is not supported: ${SolidisPairingReason}`);
  }

  return isQueueing && isSubscriptionEventName(kind)
    ? createRefusal(
        command,
        `is not supported inside a transaction: ${SolidisPairingReason}`,
      )
    : kind;
}
