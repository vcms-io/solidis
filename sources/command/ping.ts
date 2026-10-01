import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(message?: string) {
  const command = ['PING'];

  if (message !== undefined) {
    command.push(message);
  }

  return command;
}

export async function ping<T>(this: T, message?: string): Promise<string> {
  return await executeCommand(
    this,
    createCommand(message),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        return tryReplyToString(reply, command);
      }

      const echoed = tryReplyToString(reply[1], command);

      return message === undefined ? 'PONG' : echoed;
    },
  );
}
