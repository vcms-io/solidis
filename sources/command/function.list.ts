import {
  executeCommand,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToString,
  tryReplyToStringArray,
  tryReplyToStringOrNull,
} from './utils/index.ts';

import type {
  CommandFunctionListOptions,
  RespFunctionListFunction,
  RespFunctionListItem,
  StringOrBuffer,
} from '../index.ts';

function parseFunction(
  functionData: unknown,
  command: StringOrBuffer[],
): RespFunctionListFunction {
  const map = tryReplyToMap(functionData, command);

  return {
    name: tryReplyToString(map.get('name'), command),
    description: tryReplyToStringOrNull(map.get('description'), command),
    flags: tryReplyToStringArray(map.get('flags'), command),
  };
}

function parseLibrary(
  library: unknown,
  withCode: boolean,
  command: StringOrBuffer[],
): RespFunctionListItem {
  const map = tryReplyToMap(library, command);
  const result: RespFunctionListItem = {
    libraryName: tryReplyToString(map.get('library_name'), command),
    engine: tryReplyToString(map.get('engine'), command),
    functions: tryReplyArray(map.get('functions'), command).map(
      (functionData) => parseFunction(functionData, command),
    ),
  };

  if (withCode) {
    result.code = tryReplyToString(map.get('library_code'), command);
  }

  return result;
}

export function createCommand(options?: CommandFunctionListOptions) {
  const command = ['FUNCTION', 'LIST'];

  if (options?.libraryNamePattern !== undefined) {
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
  return await executeCommand(this, createCommand(options), (reply, command) =>
    tryReplyArray(reply, command).map((library) =>
      parseLibrary(library, options?.withCode === true, command),
    ),
  );
}
