import { SolidisStringSymbols } from '../index.ts';
import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(section?: string) {
  const command = ['INFO'];

  if (section !== undefined) {
    command.push(section);
  }

  return command;
}

function parseInfo(reply: string): Record<string, string> {
  const lines = reply.split(SolidisStringSymbols.NL);
  const record: Record<string, string> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, value] = trimmedLine.split(':');

      const trimmedKey = key.trim();
      const trimmedValue = value.trim();

      if (trimmedKey && trimmedValue) {
        record[trimmedKey] = trimmedValue;
      }
    }
  }

  return record;
}

export async function info<T>(
  this: T,
  section?: string,
): Promise<Record<string, string>> {
  return await executeCommand(this, createCommand(section), (reply, command) =>
    parseInfo(tryReplyToString(reply, command)),
  );
}
