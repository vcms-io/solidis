import { SolidisCredentialCommandNameSet } from '../constants.ts';
import { commandsToBuffer, getCommandName } from './request.ts';

import type { SolidisDebugMemory } from '../../modules/debug.ts';
import type {
  SolidisDebugLogType,
  StringOrBuffer,
} from '../../types/solidis.ts';

const previewLength = 1024;

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

function maskCredentials(command: StringOrBuffer[]) {
  const name = getCommandName(command);

  if (!SolidisCredentialCommandNameSet.has(name)) {
    return command;
  }

  const visibleLength = name.split(' ').length;

  return command.map((argument, index) =>
    index < visibleLength ? argument : '***',
  );
}

export function sanitizeCommandsBufferForDebug(
  buffer: Buffer,
  commands: StringOrBuffer[][],
): string {
  const hasCredentialCommand = commands.some((command) =>
    SolidisCredentialCommandNameSet.has(getCommandName(command)),
  );
  const sanitizedBuffer = hasCredentialCommand
    ? commandsToBuffer(commands.map(maskCredentials))
    : buffer;

  if (sanitizedBuffer.length > previewLength) {
    return `${sanitizedBuffer.toString('utf8', 0, previewLength)}...`;
  }

  return sanitizedBuffer.toString();
}
