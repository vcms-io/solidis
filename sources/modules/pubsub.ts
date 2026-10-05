import {
  SolidisSubscribeEventNames,
  SolidisSubscriptionEventNames,
} from '../common/constants.ts';
import { SolidisPubSubError } from '../common/utils/error.ts';
import { isStringOrBuffer, readText } from '../common/utils/internal.ts';
import { isUnsubscribeEventName } from '../common/utils/reply.ts';
import { RespPush } from '../types/resp.ts';

import type {
  SolidisClientEmit,
  SolidisClientEvents,
  SolidisData,
  SolidisMessageEventName,
  SolidisSubscriptionEventName,
} from '../types/solidis.ts';

export class SolidisPubSub {
  readonly #subscriptions = SolidisSubscribeEventNames.map(
    () => new Map<string, Buffer>(),
  );
  readonly #emit: SolidisClientEmit;

  constructor(emit: SolidisClientEmit) {
    this.#emit = emit;
  }

  public get hasActiveSubscriptions() {
    return this.#subscriptions.some((subscriptions) => subscriptions.size > 0);
  }

  public getSubscriptions(eventName: SolidisSubscriptionEventName): Buffer[] {
    return [...this.#getSubscriptions(eventName).values()];
  }

  public clearSubscriptions(eventName: SolidisSubscriptionEventName) {
    this.#getSubscriptions(eventName).clear();
  }

  public clear() {
    for (const subscriptions of this.#subscriptions) {
      subscriptions.clear();
    }
  }

  public dispatchPush(reply: RespPush) {
    this.#notify('push', reply);
  }

  public dispatchMessage(
    eventName: SolidisMessageEventName,
    reply: SolidisData[],
  ) {
    const isPattern = eventName === 'pmessage';
    const pattern = readText(reply[1]);
    const channel = isPattern ? readText(reply[2]) : pattern;
    const message = isPattern ? reply[3] : reply[2];

    if (
      channel === '__redis__:invalidate' &&
      (message === null || Array.isArray(message))
    ) {
      const push = new RespPush();

      push.push(Buffer.from('invalidate'), message);

      this.dispatchPush(push);

      return;
    }

    if (
      pattern === undefined ||
      channel === undefined ||
      !isStringOrBuffer(message)
    ) {
      this.#emitMalformedEventError(eventName);

      return;
    }

    if (isPattern) {
      this.#notify(eventName, pattern, channel, message);
    } else {
      this.#notify(eventName, channel, message);
    }
  }

  public dispatchSubscriptionChange(
    eventName: SolidisSubscriptionEventName,
    reply: SolidisData[],
  ) {
    const channel = reply[1];
    const count = reply[2];

    if (typeof count !== 'number') {
      this.#emitMalformedEventError(eventName);

      return;
    }

    if (!isStringOrBuffer(channel)) {
      return;
    }

    const subscriptions = this.#getSubscriptions(eventName);
    const bytes = Buffer.from(channel);
    const key = bytes.toString('latin1');

    if (isUnsubscribeEventName(eventName)) {
      subscriptions.delete(key);
    } else {
      subscriptions.set(key, bytes);
    }

    this.#notify(eventName, bytes.toString(), count);
  }

  #getSubscriptions(eventName: SolidisSubscriptionEventName) {
    return this.#subscriptions[
      SolidisSubscriptionEventNames.indexOf(eventName) %
        this.#subscriptions.length
    ];
  }

  #notify<E extends keyof SolidisClientEvents>(
    eventName: E,
    ...parameters: Parameters<SolidisClientEvents[E]>
  ) {
    try {
      this.#emit(eventName, ...parameters);
    } catch (error) {
      this.#emit(
        'error',
        new SolidisPubSubError(`A '${eventName}' listener threw`, error),
      );
    }
  }

  #emitMalformedEventError(eventName: string) {
    this.#emit(
      'error',
      new SolidisPubSubError(`Malformed '${eventName}' event`),
    );
  }
}
