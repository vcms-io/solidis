import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(schedule?: boolean) {
  const command = ['BGSAVE'];

  if (schedule) {
    command.push('SCHEDULE');
  }

  return command;
}

export async function bgsave<T>(this: T, schedule?: boolean): Promise<string> {
  return await executeCommand(this, createCommand(schedule), tryReplyToString);
}
