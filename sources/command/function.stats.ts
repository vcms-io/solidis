import {
  executeCommand,
  tryReplyToMap,
  tryReplyToNumber,
  tryReplyToString,
  tryReplyToStringArray,
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

    if (runningScript !== null) {
      const scriptMap = tryReplyToMap(runningScript, command);

      result.runningScript = {
        name: tryReplyToString(scriptMap.get('name'), command),
        command: tryReplyToStringArray(scriptMap.get('command'), command).join(
          ' ',
        ),
        duration: tryReplyToNumber(scriptMap.get('duration_ms'), command),
      };
    }

    for (const [name, engine] of tryReplyToMap(map.get('engines'), command)) {
      const engineMap = tryReplyToMap(engine, command);

      result.engines.push({
        name: `${name}`,
        libraries: tryReplyToNumber(engineMap.get('libraries_count'), command),
        functions: tryReplyToNumber(engineMap.get('functions_count'), command),
      });
    }

    return result;
  });
}
