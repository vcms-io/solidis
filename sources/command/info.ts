import { SolidisStringSymbols } from '../common/constants.ts';
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
      const separatorIndex = trimmedLine.indexOf(':');

      const trimmedKey = trimmedLine.slice(0, separatorIndex).trim();
      const trimmedValue = trimmedLine.slice(separatorIndex + 1).trim();

      if (separatorIndex !== -1 && trimmedKey && trimmedValue) {
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
