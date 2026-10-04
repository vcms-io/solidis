import { SolidisProtocols } from '../types/solidis.ts';
import {
  executeCommand,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToModuleInfo,
} from './utils/index.ts';

import type {
  CommandHelloParameters,
  RespHelloInfo,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(...parameters: CommandHelloParameters) {
  const [protocol, username, password, clientName] = parameters;
  const command: StringOrBuffer[] = ['HELLO'];

  if (protocol !== undefined) {
    command.push(protocol === SolidisProtocols.RESP3 ? '3' : '2');

    if (password !== undefined && (username || password)) {
      command.push('AUTH', username || 'default', password);
    }

    if (clientName) {
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

      const modules = map.get('modules') ?? [];

      return {
        server: String(map.get('server')),
        version: String(map.get('version')),
        proto: Number(map.get('proto')),
        id: Number(map.get('id')),
        mode: String(map.get('mode')),
        role: String(map.get('role')),
        modules: tryReplyArray(modules, command).map(tryReplyToModuleInfo),
      };
    },
  );
}
