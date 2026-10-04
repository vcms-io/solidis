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
  const result = tryReplyToMap(reply, command);

  const summary = result.get('summary');
  const since = result.get('since');
  const group = result.get('group');
  const complexity = result.get('complexity');
  const docFlags = result.get('doc_flags');
  const deprecatedSince = result.get('deprecated_since');
  const replacedBy = result.get('replaced_by');
  const history = result.get('history');
  const subArguments = result.get('arguments');
  const subcommands = result.get('subcommands');

  return {
    summary: summary ? String(summary) : undefined,
    since: since ? String(since) : undefined,
    group: group ? String(group) : undefined,
    complexity: complexity ? String(complexity) : undefined,
    docFlags: docFlags ? parseDocFlags(docFlags, command) : undefined,
    deprecatedSince: deprecatedSince ? String(deprecatedSince) : undefined,
    replacedBy: replacedBy ? String(replacedBy) : undefined,
    history: history ? parseHistory(history, command) : undefined,
    arguments: subArguments ? parseArguments(subArguments, command) : undefined,
    subcommands: subcommands
      ? parseCommandDocs(subcommands, command)
      : undefined,
  };
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
): RespCommandArgument[] | undefined {
  if (!Array.isArray(parameters)) {
    return undefined;
  }

  return parameters.map((parameter) => {
    const result = tryReplyToMap(parameter, command);
    const name = result.get('name');
    const type = result.get('type');
    const flags = tryReplyArray(result.get('flags') ?? [], command);
    const subArguments = result.get('arguments');

    return {
      name: String(name),
      type: String(type),
      optional: flags.some((flag) => String(flag) === 'optional'),
      multiple: flags.some((flag) => String(flag) === 'multiple'),
      arguments: parseArguments(subArguments, command),
    };
  });
}

export async function commandDocs<T>(
  this: T,
  commands?: string[],
): Promise<Record<string, RespCommandDoc>> {
  return await executeCommand(this, createCommand(commands), parseCommandDocs);
}
