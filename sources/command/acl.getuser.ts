import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  tryReplyToMap,
  tryReplyToStringArray,
} from './utils/index.ts';

import type {
  RespAclSelector,
  RespAclUserInfo,
  SolidisData,
  StringOrBuffer,
} from '../index.ts';

const parseSelector = (
  selector: SolidisData,
  command: StringOrBuffer[],
): RespAclSelector => {
  if (!Array.isArray(selector)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${selector}`, command);
  }

  const [, commands = '', , keys = '', , channels = ''] = selector;

  return {
    commands: String(commands),
    keys: String(keys),
    channels: String(channels),
  };
};

export function createCommand(username: string) {
  return ['ACL', 'GETUSER', username];
}

export async function aclGetuser<T>(
  this: T,
  username: string,
): Promise<RespAclUserInfo | null> {
  return await executeCommand(
    this,
    createCommand(username),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      const result: RespAclUserInfo = {
        flags: [],
        passwords: [],
        commands: '',
        keys: '',
        channels: '',
        selectors: [],
      };

      const map = tryReplyToMap(reply);

      const flags = map.get('flags');
      const passwords = map.get('passwords');
      const commands = map.get('commands');
      const keys = map.get('keys');
      const channels = map.get('channels');
      const selectors = map.get('selectors');

      if (flags === undefined || passwords === undefined) {
        throw newCommandError(
          `${InvalidReplyPrefix}: flags & passwords required`,
          command,
        );
      }

      result.flags = tryReplyToStringArray(flags, command);
      result.passwords = tryReplyToStringArray(passwords, command);

      if (commands !== undefined) {
        result.commands = String(commands);
      }

      if (keys !== undefined) {
        result.keys = String(keys);
      }

      if (channels !== undefined) {
        result.channels = String(channels);
      }

      if (selectors !== undefined) {
        result.selectors = Array.isArray(selectors)
          ? selectors.map((selector) => parseSelector(selector, command))
          : [];
      }

      return result;
    },
  );
}
