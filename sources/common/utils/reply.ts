import {
  SolidisMessageEventNames,
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

const SolidisMessageEventNameSet: ReadonlySet<unknown> = new Set(
  SolidisMessageEventNames,
);
const SolidisSubscriptionEventNameSet: ReadonlySet<unknown> = new Set(
  SolidisSubscriptionEventNames,
);
const SolidisUnsubscribeEventNameSet: ReadonlySet<unknown> = new Set(
  SolidisUnsubscribeEventNames,
);

export function findErrorInReplies(replies: SolidisData): false | RespError {
  if (replies instanceof RespError) {
    return replies;
  }

  if (
    Array.isArray(replies) ||
    replies instanceof Set ||
    replies instanceof Map
  ) {
    for (const reply of replies) {
      const error = findErrorInReplies(reply);

      if (error) {
        return error;
      }
    }
  }

  return false;
}

export function checkReplyIsPubSubEvent(reply: SolidisData[]): boolean {
  return getPubSubEventName(reply) !== undefined;
}

export function getPubSubEventName(
  reply: SolidisData[],
): SolidisMessageEventName | SolidisSubscriptionEventName | undefined {
  const name = reply[0];
  const eventName = Buffer.isBuffer(name) ? name.toString('latin1') : '';

  return isMessageEventName(eventName) || isSubscriptionEventName(eventName)
    ? eventName
    : undefined;
}

export function isMessageEventName(
  eventName: string | undefined,
): eventName is SolidisMessageEventName {
  return SolidisMessageEventNameSet.has(eventName);
}

export function isSubscriptionEventName(
  eventName: unknown,
): eventName is SolidisSubscriptionEventName {
  return SolidisSubscriptionEventNameSet.has(eventName);
}

export function isUnsubscribeEventName(
  eventName: string | undefined,
): eventName is SolidisUnsubscribeEventName {
  return SolidisUnsubscribeEventNameSet.has(eventName);
}
