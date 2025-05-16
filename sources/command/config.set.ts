import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(parameter: string, value: string) {
  return ['CONFIG', 'SET', parameter, value];
}

export async function configSet<T>(this: T, parameter: string, value: string) {
  return await executeCommand(
    this,
    createCommand(parameter, value),
    tryReplyOK,
  );
}
