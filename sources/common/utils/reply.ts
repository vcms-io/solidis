import { RespError, SolidisPubSubEventNames } from '../../index.ts';

import type { SolidisData } from '../../index.ts';

const SolidisPubSubEventNameSet = new Set(SolidisPubSubEventNames);
const SolidisMessageEventNameSet = new Set(SolidisPubSubEventNames.slice(0, 3));

export function findErrorInReplies(replies: SolidisData): false | RespError {
  if (replies instanceof RespError) {
    return replies;
  }

  if (Array.isArray(replies)) {
    for (const reply of replies) {
      const error = findErrorInReplies(reply);

      if (error) {
        return error;
      }
    }
  }

  return false;
}

export function checkReplyIsArray(reply: SolidisData): reply is SolidisData[] {
  if (!Array.isArray(reply)) {
    return false;
  }

  if (reply.length < 1) {
    return false;
  }

  return true;
}

function checkReplyEventName(
  reply: SolidisData[],
  nameSet: ReadonlySet<string> = SolidisPubSubEventNameSet,
): boolean {
  const eventName = reply[0];

  if (!Buffer.isBuffer(eventName)) {
    return false;
  }

  return nameSet.has(eventName.toString('latin1'));
}

export function checkReplyIsPubSubEvent(reply: SolidisData[]): boolean {
  return checkReplyEventName(reply);
}

export function checkReplyIsMessageEvent(reply: SolidisData[]): boolean {
  return checkReplyEventName(reply, SolidisMessageEventNameSet);
}
