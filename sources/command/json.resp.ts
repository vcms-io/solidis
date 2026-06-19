import { buildJsonKeyPathCommand, executeCommand } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(key: string, path?: string) {
  return buildJsonKeyPathCommand('JSON.RESP', key, path);
}

export async function jsonResp<T>(
  this: T,
  key: string,
  path?: string,
): Promise<SolidisData> {
  return await executeCommand(this, createCommand(key, path), (reply) => reply);
}
