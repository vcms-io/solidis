import type { SolidisDebugLogType, SolidisDebugMemory } from '../../index.ts';

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
