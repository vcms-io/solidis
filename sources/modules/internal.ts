import { SolidisSubscriptionEventNames } from '../common/constants.ts';

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
