import {
  executeCommand,
  newCommandError,
  tryReplyToStringArray,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand(filter: Record<string, string>) {
  const command = ['TS.QUERYINDEX'];

  for (const [label, value] of Object.entries(filter)) {
    command.push(label, '=', value);
  }

  return command;
}

export async function tsQueryindex<T>(
  this: T,
  filter: Record<string, string>,
): Promise<string[]> {
  return await executeCommand(this, createCommand(filter), (reply, command) => {
    if (!Array.isArray(reply)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    }

    return tryReplyToStringArray(reply, command);
  });
}
