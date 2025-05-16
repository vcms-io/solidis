import {
  InvalidReplyPrefix,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToMap,
  tryReplyToStringRecordRecursively,
} from './utils/index.ts';

import type {
  RespCommandArgument,
  RespCommandDoc,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(commands?: string[]) {
  const command = ['COMMAND', 'DOCS'];

  if (commands?.length) {
    command.push(...commands);
  }

  return command;
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
  const args = result.get('arguments');
  const subcommands = result.get('subcommands');

  return {
    summary: summary ? String(summary) : undefined,
    since: since ? String(since) : undefined,
    group: group ? String(group) : undefined,
    complexity: complexity ? String(complexity) : undefined,
    docFlags: docFlags ? parseDocFlags(docFlags) : undefined,
    deprecatedSince: deprecatedSince ? String(deprecatedSince) : undefined,
    replacedBy: replacedBy ? String(replacedBy) : undefined,
    history: history ? parseHistory(history, command) : undefined,
    arguments: args ? parseArguments(args, command) : undefined,
    subcommands: subcommands
      ? tryReplyToStringRecordRecursively(subcommands, command)
      : undefined,
  };
}

function parseDocFlags(
  flags: unknown,
): Array<'deprecated' | 'syscmd'> | undefined {
  if (!Array.isArray(flags)) {
    return undefined;
  }

  return flags
    .map((flag) => String(flag))
    .filter((flag): flag is 'deprecated' | 'syscmd' =>
      ['deprecated', 'syscmd'].includes(flag),
    );
}

function parseHistory(
  history: unknown,
  command: StringOrBuffer[],
): string[] | undefined {
  if (!Array.isArray(history)) {
    return undefined;
  }

  return history.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw newCommandError(`${InvalidReplyPrefix}: ${entry}`, command);
    }

    const [version, description] = entry;

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
    const optional = result.get('optional') === true;
    const multiple = result.get('multiple') === true;
    const args = result.get('arguments');

    return {
      name: String(name),
      type: String(type),
      optional,
      multiple,
      arguments: parseArguments(args, command),
    };
  });
}

export async function commandDocs<T>(
  this: T,
  commands?: string[],
): Promise<Record<string, RespCommandDoc>> {
  return await executeCommand(
    this,
    createCommand(commands),
    (reply, command) => {
      const result: Record<string, RespCommandDoc> = {};

      processPairedArray(
        reply,
        (key, value) => {
          const parsedDoc = parseCommandDoc(value, command);

          if (typeof key === 'string') {
            result[key] = parsedDoc;
          }
        },
        command,
      );

      return result;
    },
  );
}
