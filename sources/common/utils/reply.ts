import {
  SolidisMessageEventNames,
  SolidisPubSubEventNames,
  SolidisSubscriptionEventNames,
  SolidisUnsubscribeEventNames,
} from '../constants.ts';
import { RespError } from './error.ts';

import type {
  SolidisData,
  SolidisMessageEventName,
  SolidisSubscriptionEventName,
  SolidisUnsubscribeEventName,
} from '../../types/solidis.ts';

const SolidisPubSubEventNameSet: ReadonlySet<string> = new Set(
  SolidisPubSubEventNames,
);
const SolidisMessageEventNameSet: ReadonlySet<string> = new Set(
  SolidisMessageEventNames,
);
const SolidisSubscriptionEventNameSet: ReadonlySet<string> = new Set(
  SolidisSubscriptionEventNames,
);
const SolidisUnsubscribeEventNameSet: ReadonlySet<string> = new Set(
  SolidisUnsubscribeEventNames,
);

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

function readEventName(reply: SolidisData[]) {
  const eventName = reply[0];

  return Buffer.isBuffer(eventName) ? eventName.toString('latin1') : undefined;
}

export function checkReplyIsPubSubEvent(reply: SolidisData[]): boolean {
  const eventName = readEventName(reply);

  return eventName !== undefined && SolidisPubSubEventNameSet.has(eventName);
}

export function getPubSubEventName(reply: SolidisData[]): string | undefined {
  return reply.length >= 3 && checkReplyIsPubSubEvent(reply)
    ? readEventName(reply)
    : undefined;
}

export function isMessageEventName(
  eventName: string,
): eventName is SolidisMessageEventName {
  return SolidisMessageEventNameSet.has(eventName);
}

export function isSubscriptionEventName(
  eventName: string,
): eventName is SolidisSubscriptionEventName {
  return SolidisSubscriptionEventNameSet.has(eventName);
}

export function isUnsubscribeEventName(
  eventName: string,
): eventName is SolidisUnsubscribeEventName {
  return SolidisUnsubscribeEventNameSet.has(eventName);
}
