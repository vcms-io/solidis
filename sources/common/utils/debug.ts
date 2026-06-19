import { SolidisCredentialCommandNameSet } from '../constants.ts';
import { commandsToBuffer } from './request.ts';

import type {
  SolidisDebugLogType,
  SolidisDebugMemory,
  StringOrBuffer,
} from '../../index.ts';

export function generateDebugHandle(debugMemory?: SolidisDebugMemory) {
  if (!debugMemory) {
    return;
  }

  return (type: SolidisDebugLogType, message: string, data?: unknown) => {
    debugMemory.write({
      type,
      message,
      data,
    });
  };
}

export function sanitizeCommandsBufferForDebug(
  buffer: Buffer,
  commands: StringOrBuffer[][],
): string {
  const hasCredentialCommand = commands.some((command) => {
    const name = command[0]?.toString().toUpperCase() ?? '';

    return SolidisCredentialCommandNameSet.has(name);
  });

  if (!hasCredentialCommand) {
    return buffer.toString();
  }

  return commandsToBuffer(
    commands.map((command) => {
      const name = command[0]?.toString().toUpperCase() ?? '';

      if (!SolidisCredentialCommandNameSet.has(name)) {
        return command;
      }

      return [command[0], ...command.slice(1).map(() => '***')];
    }),
  ).toString();
}
