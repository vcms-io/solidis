import {
  SolidisSubscribeEventNames,
  SolidisSubscriptionEventNames,
} from '../common/constants.ts';
import { SolidisPubSubError } from '../common/utils/error.ts';
import { isUnsubscribeEventName } from '../common/utils/reply.ts';

import type {
  SolidisClientEmit,
  SolidisData,
  SolidisMessageEventName,
  SolidisSubscriptionEventName,
  StringOrBuffer,
} from '../types/solidis.ts';

function toText(value: SolidisData | undefined) {
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }

  return typeof value === 'string' ? value : undefined;
}

function isPayload(value: SolidisData | undefined): value is StringOrBuffer {
  return typeof value === 'string' || Buffer.isBuffer(value);
}

export class SolidisPubSub {
  readonly #subscriptions = SolidisSubscribeEventNames.map(
    () => new Set<string>(),
  );
  readonly #emit: SolidisClientEmit;

  constructor(emit: SolidisClientEmit) {
    this.#emit = emit;
  }

  public get hasActiveSubscriptions() {
    return this.#subscriptions.some((subscriptions) => subscriptions.size > 0);
  }

  public getSubscriptions(
    eventName: SolidisSubscriptionEventName,
  ): ReadonlySet<string> {
    return this.#getSubscriptions(eventName);
  }

  public clearSubscriptions(eventName: SolidisSubscriptionEventName) {
    this.#getSubscriptions(eventName).clear();
  }

  public clear() {
    for (const subscriptions of this.#subscriptions) {
      subscriptions.clear();
    }
  }

  public dispatchMessage(
    eventName: SolidisMessageEventName,
    reply: SolidisData[],
  ) {
    const isPattern = eventName === 'pmessage';
    const pattern = toText(reply[1]);
    const channel = isPattern ? toText(reply[2]) : pattern;
    const message = isPattern ? reply[3] : reply[2];

    if (pattern === undefined || channel === undefined || !isPayload(message)) {
      this.#emitMalformedEventError(eventName);

      return;
    }

    try {
      if (isPattern) {
        this.#emit(eventName, pattern, channel, message);
      } else {
        this.#emit(eventName, channel, message);
      }
    } catch (error) {
      this.#emitListenerError(eventName, error);
    }
  }

  public dispatchSubscriptionChange(
    eventName: SolidisSubscriptionEventName,
    reply: SolidisData[],
  ) {
    const channel = toText(reply[1]);
    const count = reply[2];

    if (typeof count !== 'number') {
      this.#emitMalformedEventError(eventName);

      return;
    }

    if (channel === undefined) {
      return;
    }

    const subscriptions = this.#getSubscriptions(eventName);

    if (isUnsubscribeEventName(eventName)) {
      subscriptions.delete(channel);
    } else {
      subscriptions.add(channel);
    }

    try {
      this.#emit(eventName, channel, count);
    } catch (error) {
      this.#emitListenerError(eventName, error);
    }
  }

  #getSubscriptions(eventName: SolidisSubscriptionEventName) {
    const index = SolidisSubscriptionEventNames.indexOf(eventName);

    return this.#subscriptions[index % this.#subscriptions.length];
  }

  #emitMalformedEventError(eventName: string) {
    this.#emit(
      'error',
      new SolidisPubSubError(`Malformed '${eventName}' event`),
    );
  }

  #emitListenerError(eventName: string, error: unknown) {
    this.#emit(
      'error',
      new SolidisPubSubError(`A '${eventName}' listener threw`, error),
    );
  }
}
