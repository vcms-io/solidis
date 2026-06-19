import { SolidisPubSubError } from '../index.ts';

import type {
  SolidisClientEventHandlers,
  SolidisData,
  SolidisTranslatedPubSubReplies,
} from '../index.ts';

export class SolidisPubSub {
  #subscribedChannels: Set<string> = new Set();
  #subscribedShardChannels: Set<string> = new Set();
  #psubscribedPatterns: Set<string> = new Set();

  public get subscribedChannels(): ReadonlySet<string> {
    return this.#subscribedChannels;
  }

  public get subscribedShardChannels(): ReadonlySet<string> {
    return this.#subscribedShardChannels;
  }

  public get subscribedPatterns(): ReadonlySet<string> {
    return this.#psubscribedPatterns;
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

  #dispatchSubscriptionChange(
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const event = pubSubReply[0];
    const channel = pubSubReply[1];
    const count = pubSubReply[2];

    if (!channel || typeof count !== 'number') {
      this.#dispatchPubSubError(`${event}:type`, pubSubReply, emit);

      return;
    }

    switch (event) {
      case 'subscribe': {
        this.#subscribedChannels.add(channel);

        break;
      }

      case 'ssubscribe': {
        this.#subscribedShardChannels.add(channel);

        break;
      }

      case 'psubscribe': {
        this.#psubscribedPatterns.add(channel);

        break;
      }

      case 'unsubscribe': {
        this.#subscribedChannels.delete(channel);

        break;
      }

      case 'sunsubscribe': {
        this.#subscribedShardChannels.delete(channel);

        break;
      }

      case 'punsubscribe': {
        this.#psubscribedPatterns.delete(channel);

        break;
      }

      default: {
        this.#dispatchPubSubError(`${event}:event`, pubSubReply, emit);

        return;
      }
    }

    emit(event, channel, count);
  }
}
