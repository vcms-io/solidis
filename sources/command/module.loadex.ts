import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  path: string,
  config?: Record<string, string>,
  parameters?: string[],
) {
  const command = ['MODULE', 'LOADEX', path];

  if (config) {
    for (const [name, value] of Object.entries(config)) {
      command.push('CONFIG', name, value);
    }
  }

  if (parameters?.length) {
    command.push('ARGS', ...parameters);
  }

  return command;
}

export async function moduleLoadex<T>(
  this: T,
  path: string,
  config?: Record<string, string>,
  parameters?: string[],
) {
  return await executeCommand(
    this,
    createCommand(path, config, parameters),
    tryReplyOK,
  );
}
