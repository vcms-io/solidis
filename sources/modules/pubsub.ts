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

  public get subscribedChannels() {
    return this.#subscribedChannels;
  }

  public get subscribedShardChannels() {
    return this.#subscribedShardChannels;
  }

  public get subscribedPatterns() {
    return this.#psubscribedPatterns;
  }

  public dispatchPubSubEvent(
    reply: SolidisData[],
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const pubSubReply = this.#translateRepliesForPubSub(reply);

    const event = pubSubReply[0];

    switch (event) {
      case 'message': {
        this.#dispatchMessage(pubSubReply, emit);

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
      typeof reply[2] === 'number' ? reply[2] : (reply[2]?.toString() ?? null),
      reply[3]?.toString() ?? null,
    ];
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
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const channel = pubSubReply[1];
    const message = pubSubReply[2];

    if (typeof channel !== 'string' || typeof message !== 'string') {
      this.#dispatchPubSubError('message:type', pubSubReply, emit);

      return;
    }

    emit('message', channel, message);
  }

  #dispatchPmessage(
    pubSubReply: SolidisTranslatedPubSubReplies,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const pattern = pubSubReply[1];
    const channel = pubSubReply[2];
    const message = pubSubReply[3];

    if (
      typeof pattern !== 'string' ||
      typeof channel !== 'string' ||
      typeof message !== 'string'
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
