import { SolidisPubSubError } from '../index.ts';

import type {
  SolidisClientEventHandlers,
  SolidisData,
  SolidisSubscribeEvents,
  SolidisTranslatedPubSubReplies,
} from '../index.ts';

export class SolidisPubSub {
  #subscribedChannels: Set<string> = new Set();
  #subscribedShardChannels: Set<string> = new Set();
  #psubscribedPatterns: Set<string> = new Set();

  #subscriptionChannelMap: Record<string, Set<string>> = {
    subscribe: this.#subscribedChannels,
    ssubscribe: this.#subscribedShardChannels,
    psubscribe: this.#psubscribedPatterns,
    unsubscribe: this.#subscribedChannels,
    sunsubscribe: this.#subscribedShardChannels,
    punsubscribe: this.#psubscribedPatterns,
  };

  public get subscribedChannels(): ReadonlySet<string> {
    return this.#subscribedChannels;
  }

  public get subscribedShardChannels(): ReadonlySet<string> {
    return this.#subscribedShardChannels;
  }

  public get subscribedPatterns(): ReadonlySet<string> {
    return this.#psubscribedPatterns;
  }

  public getChannelsForUnsubscribeCommand(
    commandName: string,
  ): ReadonlySet<string> | undefined {
    const lower = commandName.toLowerCase();

    if (!lower.includes('unsubscribe')) {
      return undefined;
    }

    return this.#subscriptionChannelMap[lower];
  }

  public clearSubscribedChannels() {
    this.#subscribedChannels.clear();
  }

  public clearSubscribedShardChannels() {
    this.#subscribedShardChannels.clear();
  }

  public clearSubscribedPatterns() {
    this.#psubscribedPatterns.clear();
  }

  public get hasActiveSubscriptions() {
    return (
      this.#subscribedChannels.size > 0 ||
      this.#subscribedShardChannels.size > 0 ||
      this.#psubscribedPatterns.size > 0
    );
  }

  public dispatchPubSubEvent(
    reply: SolidisData[],
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const pubSubReply = this.#translateRepliesForPubSub(reply);

    const event = pubSubReply[0];

    switch (event) {
      case 'message':
      case 'smessage': {
        this.#dispatchMessage(event, pubSubReply, emit);

        return;
      }

      case 'pmessage': {
        this.#dispatchPmessage(pubSubReply, emit);

        return;
      }
    }

    this.#dispatchSubscriptionChange(pubSubReply, emit);
  }

  #translateRepliesForPubSub(
    reply: SolidisData[],
  ): SolidisTranslatedPubSubReplies {
    return [
      reply[0]?.toString() ?? null,
      reply[1]?.toString() ?? null,
      typeof reply[2] === 'number' ? reply[2] : this.#toMessage(reply[2]),
      this.#toMessage(reply[3]),
    ];
  }

  #toMessage(reply: SolidisData | undefined) {
    if (typeof reply === 'string' || Buffer.isBuffer(reply)) {
      return reply;
    }

    return reply?.toString() ?? null;
  }

  #dispatchPubSubError(
    error: unknown,
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    emit(
      'error',
      new SolidisPubSubError(String(error), {
        error,
        pubSubReply,
      }),
    );
  }

  #dispatchMessage(
    event: 'message' | 'smessage',
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const channel = pubSubReply[1];
    const message = pubSubReply[2];

    if (
      typeof channel !== 'string' ||
      !(typeof message === 'string' || Buffer.isBuffer(message))
    ) {
      this.#dispatchPubSubError(`${event}:type`, pubSubReply, emit);

      return;
    }

    emit(event, channel, message);
  }

  #dispatchPmessage(
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const pattern = pubSubReply[1];
    const channel = pubSubReply[2]?.toString();
    const message = pubSubReply[3];

    if (
      typeof pattern !== 'string' ||
      typeof channel !== 'string' ||
      !(typeof message === 'string' || Buffer.isBuffer(message))
    ) {
      this.#dispatchPubSubError('pmessage:type', pubSubReply, emit);

      return;
    }

    emit('pmessage', pattern, channel, message);
  }

  #isSubscriptionEvent(event: string): event is keyof SolidisSubscribeEvents {
    return event in this.#subscriptionChannelMap;
  }

  #dispatchSubscriptionChange(
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const event = pubSubReply[0];
    const channel = pubSubReply[1];
    const count = pubSubReply[2];

    if (!event || !channel || typeof count !== 'number') {
      this.#dispatchPubSubError(`${event}:type`, pubSubReply, emit);

      return;
    }

    if (!this.#isSubscriptionEvent(event)) {
      this.#dispatchPubSubError(`${event}:event`, pubSubReply, emit);

      return;
    }

    const channelSet = this.#subscriptionChannelMap[event];

    if (event.includes('unsubscribe')) {
      channelSet.delete(channel);
    } else {
      channelSet.add(channel);
    }

    emit(event, channel, count);
  }
}
