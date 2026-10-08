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
      const isSubscribed = Array.isArray(reply);
      const text = tryReplyToString(isSubscribed ? reply[1] : reply, command);

      return isSubscribed && message === undefined ? 'PONG' : text;
    },
  );
}
