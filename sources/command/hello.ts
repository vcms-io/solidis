import { SolidisProtocols } from '../types/solidis.ts';
import {
  executeCommand,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToModuleInfo,
  tryReplyToNumber,
} from './utils/index.ts';

import type {
  CommandHelloParameters,
  RespHelloInfo,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(
  ...[protocol, username, password, clientName]: CommandHelloParameters
) {
  const command: StringOrBuffer[] = ['HELLO'];

  if (protocol !== undefined) {
    command.push(protocol === SolidisProtocols.RESP3 ? '3' : '2');

    if (password !== undefined) {
      command.push('AUTH', username?.length ? username : 'default', password);
    }

    if (clientName !== undefined) {
      command.push('SETNAME', clientName);
    }
  }

  return command;
}

export async function hello<T>(
  this: T,
  ...parameters: CommandHelloParameters
): Promise<RespHelloInfo> {
  return await executeCommand(
    this,
    createCommand(...parameters),
    (reply, command) => {
      const map = tryReplyToMap(reply, command);
      const toText = (key: string) => String(map.get(key));
      const toNumber = (key: string) =>
        tryReplyToNumber(map.get(key) ?? Number.NaN, command);

      return {
        server: toText('server'),
        version: toText('version'),
        proto: toNumber('proto'),
        id: toNumber('id'),
        mode: toText('mode'),
        role: map.has('role') ? toText('role') : null,
        modules: tryReplyArray(map.get('modules') ?? [], command).map((item) =>
          tryReplyToModuleInfo(item, command),
        ),
      };
    },
  );
}
