import {
  executeCommand,
  tryReplyToMap,
  tryReplyToNumber,
  tryReplyToString,
} from './utils/index.ts';

import type { RespFunctionStats } from '../index.ts';

export function createCommand() {
  return ['FUNCTION', 'STATS'];
}

export async function functionStats<T>(this: T): Promise<RespFunctionStats> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    /** RESP2 nests every level as flat arrays; RESP3 uses maps. */
    const map = tryReplyToMap(reply, command);

    const result: RespFunctionStats = {
      runningScript: null,
      engines: [],
    };

    const runningScript = map.get('running_script');

    if (runningScript !== null && runningScript !== undefined) {
      const scriptMap = tryReplyToMap(runningScript, command);

      result.runningScript = {
        name: tryReplyToString(scriptMap.get('name'), command),
        command: tryReplyToString(scriptMap.get('command'), command),
        duration: tryReplyToNumber(scriptMap.get('duration_ms'), command),
      };
    }

    const engines = map.get('engines');

    if (engines !== null && engines !== undefined) {
      for (const [engineName, engineInfo] of tryReplyToMap(engines, command)) {
        const engineMap = tryReplyToMap(engineInfo, command);

        result.engines.push({
          name: `${engineName}`,
          libraries: tryReplyToNumber(
            engineMap.get('libraries_count') ?? engineMap.get('libraries'),
            command,
          ),
          functions: tryReplyToNumber(
            engineMap.get('functions_count') ?? engineMap.get('functions'),
            command,
          ),
        });
      }
    }

    return result;
  });
}
