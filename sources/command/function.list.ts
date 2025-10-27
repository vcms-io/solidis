import {
  executeCommand,
  newCommandError,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToString,
  tryReplyToStringArray,
  tryReplyToStringOrNull,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type {
  CommandFunctionListOptions,
  RespFunctionListFunction,
  RespFunctionListItem,
  StringOrBuffer,
} from '../index.ts';

function parseFunction(
  func: unknown,
  command: StringOrBuffer[],
): RespFunctionListFunction {
  const result: RespFunctionListFunction = {
    name: '',
    description: null,
    flags: [],
  };

  const map = tryReplyToMap(func, command);
  const name = tryReplyToString(map.get('name'), command);
  const description = tryReplyToStringOrNull(map.get('description'));
  const flags = tryReplyToStringArray(map.get('flags'), command);

  result.name = name;
  result.description = description;
  result.flags = flags;

  return result;
}

function parseLibrary(
  library: unknown,
  withCode: boolean,
  command: StringOrBuffer[],
): RespFunctionListItem {
  const result: RespFunctionListItem = {
    libraryName: '',
    engine: '',
    functions: [],
  };

  const map = tryReplyToMap(library, command);

  const libraryName = tryReplyToString(map.get('library_name'), command);
  const engine = tryReplyToString(map.get('engine'), command);
  const functions = tryReplyArray(map.get('functions'), command);

  result.libraryName = libraryName;
  result.engine = engine;
  result.functions = functions.map((func) => parseFunction(func, command));

  if (withCode) {
    const code = tryReplyToString(map.get('library_code'));
    result.code = code;
  }

  return result;
}

export function createCommand(options?: CommandFunctionListOptions) {
  const command = ['FUNCTION', 'LIST'];

  if (options?.libraryNamePattern) {
    command.push('LIBRARYNAME', options.libraryNamePattern);
  }

  if (options?.withCode) {
    command.push('WITHCODE');
  }

  return command;
}

export async function functionList<T>(
  this: T,
  options?: CommandFunctionListOptions,
): Promise<RespFunctionListItem[]> {
  return await executeCommand(
    this,
    createCommand(options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((library) =>
        parseLibrary(library, options?.withCode ?? false, command),
      );
    },
  );
}
