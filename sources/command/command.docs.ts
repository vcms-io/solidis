import {
  executeCommand,
  newCommandError,
  processPairedArray,
  setRecordEntry,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToStringArray,
  tryReplyTuple,
} from './utils/index.ts';

import type {
  RespCommandArgument,
  RespCommandDoc,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(commands?: string[]) {
  if (commands?.length === 0) {
    throw newCommandError(
      'An empty list of commands would return every command',
      'COMMAND DOCS',
    );
  }

  return ['COMMAND', 'DOCS', ...(commands ?? [])];
}

function parseCommandDocs(
  reply: unknown,
  command: StringOrBuffer[],
): Record<string, RespCommandDoc> {
  const result: Record<string, RespCommandDoc> = {};

  processPairedArray(
    reply,
    (key, value) => {
      setRecordEntry(result, key, parseCommandDoc(value, command));
    },
    command,
  );

  return result;
}

function parseCommandDoc(
  reply: unknown,
  command: StringOrBuffer[],
): RespCommandDoc {
  const result: RespCommandDoc = {};

  for (const [key, value] of tryReplyToMap(reply, command)) {
    if (
      key === 'summary' ||
      key === 'since' ||
      key === 'group' ||
      key === 'complexity'
    ) {
      result[key] = String(value);
    } else if (key === 'deprecated_since') {
      result.deprecatedSince = String(value);
    } else if (key === 'replaced_by') {
      result.replacedBy = String(value);
    } else if (key === 'doc_flags') {
      result.docFlags = parseDocFlags(value, command);
    } else if (key === 'history') {
      result.history = parseHistory(value, command);
    } else if (key === 'arguments') {
      result.arguments = parseArguments(value, command);
    } else if (key === 'subcommands') {
      result.subcommands = parseCommandDocs(value, command);
    }
  }

  return result;
}

function parseDocFlags(
  flags: unknown,
  command: StringOrBuffer[],
): Array<'deprecated' | 'syscmd'> {
  return tryReplyToStringArray(flags, command).filter(
    (flag): flag is 'deprecated' | 'syscmd' =>
      flag === 'deprecated' || flag === 'syscmd',
  );
}

function parseHistory(history: unknown, command: StringOrBuffer[]) {
  return tryReplyArray(history, command).map((entry) => {
    const [version, description] = tryReplyTuple(entry, 2, command);

    return `${String(version)}: ${String(description)}`;
  });
}

function parseArguments(
  parameters: unknown,
  command: StringOrBuffer[],
): RespCommandArgument[] {
  return tryReplyArray(parameters, command).map((parameter) => {
    const map = tryReplyToMap(parameter, command);
    const flags = tryReplyArray(map.get('flags') ?? [], command);
    const subArguments = map.get('arguments');
    const result: RespCommandArgument = {
      name: String(map.get('name')),
      type: String(map.get('type')),
      optional: flags.some((flag) => String(flag) === 'optional'),
      multiple: flags.some((flag) => String(flag) === 'multiple'),
    };

    if (subArguments !== undefined) {
      result.arguments = parseArguments(subArguments, command);
    }

    return result;
  });
}

export async function commandDocs<T>(
  this: T,
  commands?: string[],
): Promise<Record<string, RespCommandDoc>> {
  return await executeCommand(this, createCommand(commands), parseCommandDocs);
}
