import {
  InvalidReplyPrefix,
  executeCommand,
  newCommandError,
  tryReplyToMap,
  tryReplyToModuleInfo,
} from './utils/index.ts';

import { SolidisProtocols } from '../index.ts';

import type { RespHelloInfo } from '../index.ts';

export function createCommand(
  protocol: SolidisProtocols,
  username?: string,
  password?: string,
  clientName?: string,
) {
  const command = ['HELLO'];

  if (protocol !== undefined) {
    command.push(protocol === SolidisProtocols.RESP3 ? '3' : '2');

    if (username && password) {
      command.push('AUTH', username, password);
    } else if (password) {
      command.push('AUTH', 'default', password);
    }

    if (clientName) {
      command.push('SETNAME', clientName);
    }
  }

  return command;
}

export async function hello<T>(
  this: T,
  protocol: SolidisProtocols,
  username?: string,
  password?: string,
  clientName?: string,
): Promise<RespHelloInfo> {
  return await executeCommand(
    this,
    createCommand(protocol, username, password, clientName),
    (reply, command) => {
      const map = tryReplyToMap(reply);

      const modules = map.get('modules');

      if (!Array.isArray(modules)) {
        throw newCommandError(`${InvalidReplyPrefix}: ${modules}`, command);
      }

      return {
        server: String(map.get('server')),
        version: String(map.get('version')),
        proto: Number(map.get('proto')),
        id: Number(map.get('id')),
        mode: String(map.get('mode')),
        role: String(map.get('role')),
        modules: modules.map(tryReplyToModuleInfo),
      };
    },
  );
}
