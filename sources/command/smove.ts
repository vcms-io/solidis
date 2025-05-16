import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(
  source: string,
  destination: string,
  member: string,
) {
  return ['SMOVE', source, destination, member];
}

export async function smove<T>(
  this: T,
  source: string,
  destination: string,
  member: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(source, destination, member),
    tryReplyNumber,
  );
}
