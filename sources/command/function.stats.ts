import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  tryReplyToNumber,
  tryReplyToString,
} from './utils/index.ts';

import type { RespFunctionStats } from '../index.ts';

export function createCommand() {
  return ['FUNCTION', 'STATS'];
}

export async function functionStats<T>(this: T): Promise<RespFunctionStats> {
  return await executeCommand(
    this,
    createCommand(),
    (reply, functionStatsCommand) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(
          `${UnexpectedReplyPrefix}: ${reply}`,
          functionStatsCommand,
        );
      }

      const result: RespFunctionStats = {
        runningScript: null,
        engines: [],
      };

      for (const item of reply) {
        if (!Array.isArray(item)) {
          throw newCommandError(
            `${InvalidReplyPrefix}: ${item}`,
            functionStatsCommand,
          );
        }

        const [key, value] = item;

        if (!(typeof key === 'string' || key instanceof Buffer)) {
          throw newCommandError(
            `${InvalidReplyPrefix}: ${key}`,
            functionStatsCommand,
          );
        }

        switch (`${key}`) {
          case 'running_script': {
            if (value === null) {
              break;
            }

            if (!Array.isArray(value)) {
              throw newCommandError(
                `${InvalidReplyPrefix}: ${value}`,
                functionStatsCommand,
              );
            }

            const [name, command, duration] = value;

            result.runningScript = {
              name: tryReplyToString(name),
              command: tryReplyToString(command),
              duration: tryReplyToNumber(duration),
            };

            break;
          }

          case 'engines': {
            if (!Array.isArray(value)) {
              throw newCommandError(
                `${InvalidReplyPrefix}: ${value}`,
                functionStatsCommand,
              );
            }

            result.engines = value.map((engine) => {
              if (!Array.isArray(engine)) {
                throw newCommandError(
                  `${InvalidReplyPrefix}: ${engine}`,
                  functionStatsCommand,
                );
              }

              const [name, libraries, functions] = engine;

              return {
                name: tryReplyToString(name),
                libraries: tryReplyToNumber(libraries),
                functions: tryReplyToNumber(functions),
              };
            });

            break;
          }

          default: {
            throw newCommandError(
              `${InvalidReplyPrefix}: ${key}`,
              functionStatsCommand,
            );
          }
        }
      }

      return result;
    },
  );
}
