import {
  RespError,
  SolidisMessageEvent,
  SolidisPMessageEvent,
  SolidisPubSubEventNameSet,
} from '../../index.ts';

import type { SolidisData, SolidisPipelineSubRequest } from '../../index.ts';

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

export function checkReplyIsPubSubEvent(reply: SolidisData[]): boolean {
  const eventName = reply[0];

  if (!eventName || !(eventName instanceof Buffer)) {
    return false;
  }

  return SolidisPubSubEventNameSet.has(eventName.toString('latin1'));
}

export function checkReplyIsMessageEvent(reply: SolidisData[]): boolean {
  const eventName = reply[0];

  if (!Buffer.isBuffer(eventName)) {
    return false;
  }

  const eventNameString = eventName.toString('latin1');

  const isMessageEvent = SolidisMessageEvent === eventNameString;
  const isPMessageEvent = SolidisPMessageEvent === eventNameString;

  return isMessageEvent || isPMessageEvent;
}

export function extractSubReplies(
  parsedReplies: SolidisData[],
  subRequest: SolidisPipelineSubRequest,
): SolidisData[] {
  return parsedReplies.slice(subRequest.cursor, subRequest.cursor + 1);
}
