import { SolidisMaximumTimerDelay } from '../internal.ts';

export const SolidisSocketNotConnectedMessage = 'Socket is not connected.';
export const SolidisClientQuitMessage = 'The client was quit.';

export function toTextPrefix(argument: string | Buffer, length: number) {
  return typeof argument === 'string'
    ? argument.slice(0, length)
    : argument.toString('utf8', 0, length * 4);
}

export function resolveTimerDelay(delay: number) {
  return delay > 0 && delay <= SolidisMaximumTimerDelay ? delay : 0;
}
