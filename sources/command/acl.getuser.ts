import {
  executeCommand,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToStringArray,
} from './utils/index.ts';

import type {
  RespAclSelector,
  RespAclUserInfo,
  StringOrBuffer,
} from '../index.ts';

function parseSelector(
  selector: unknown,
  command: StringOrBuffer[],
): RespAclSelector {
  const map = tryReplyToMap(selector, command);

  return {
    commands: String(map.get('commands') ?? ''),
    keys: String(map.get('keys') ?? ''),
    channels: String(map.get('channels') ?? ''),
  };
}

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

      const map = tryReplyToMap(reply, command);

      return {
        flags: tryReplyToStringArray(map.get('flags'), command),
        passwords: tryReplyToStringArray(map.get('passwords'), command),
        commands: String(map.get('commands') ?? ''),
        keys: String(map.get('keys') ?? ''),
        channels: String(map.get('channels') ?? ''),
        selectors: tryReplyArray(map.get('selectors') ?? [], command).map(
          (selector) => parseSelector(selector, command),
        ),
      };
    },
  );
}
