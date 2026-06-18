import {
  checkReplyIsArray,
  checkReplyIsMessageEvent,
  checkReplyIsPubSubEvent,
  commandsToBuffer,
  extractNextChunkToWrite,
  findErrorInReplies,
  generateDebugHandle,
  RespPush,
  SolidisParser,
  SolidisProtocols,
  SolidisRequesterError,
  SolidisSubscribeCommandNameSet,
  sanitizeCommandsBufferForDebug,
  wrapWithParserError,
  wrapWithSolidisRequesterError,
} from '../index.ts';

import type {
  SolidisClientEventHandlers,
  SolidisData,
  SolidisDebugLogType,
  SolidisPipelineRequest,
  SolidisPipelineRequestChunk,
  SolidisPipelineRequestChunkContext,
  SolidisPipelineSubRequest,
  SolidisRequest,
  SolidisRequesterOptions,
  SolidisSocketWriteEventHandlers,
  StringOrBuffer,
} from '../index.ts';

export class SolidisRequester {
  #options: SolidisRequesterOptions;

  #parser: SolidisParser;

  #requestQueue: SolidisPipelineRequest[] = [];
  #inflightQueue: SolidisPipelineRequest[] = [];

  #requests: SolidisRequest[] = [];
  #replyBuffers: Buffer[] = [];

  #requestLock: Promise<void> = Promise.resolve();
  #replyLock: Promise<void> = Promise.resolve();

  #scheduledRequests?: NodeJS.Immediate;
  #scheduledReplies?: NodeJS.Immediate;

  #isOnRecovery = false;

  #negotiatedProtocol: SolidisProtocols = SolidisProtocols.RESP2;
  #pendingSubscribeCommandCount = 0;

  #debug?: (type: SolidisDebugLogType, message: string, data?: unknown) => void;

  constructor(options: SolidisRequesterOptions) {
    this.#options = options;
    this.#parser = new SolidisParser(options);

    this.#debug = generateDebugHandle(options.debugMemory);
  }

  public setNegotiatedProtocol(protocol: SolidisProtocols) {
    this.#negotiatedProtocol = protocol;
  }

  public async send(commands: StringOrBuffer[][]): Promise<SolidisData[][]> {
    if (commands.length === 0) {
      return [];
    }

    return await new Promise<SolidisData[][]>((resolve, reject) => {
      this.#requests.push({
        commands,
        resolve,
        reject,
        replies: [],
      });

      this.#scheduleRequests();
    });
  }

  #scheduleRequests() {
    if (this.#scheduledRequests) {
      return;
    }

    this.#scheduledRequests = setImmediate(() => {
      this.#requestLock = this.#requestLock.then(async () => {
        try {
          await this.#createPipelineFromRequests();
        } catch (error: unknown) {
          this.recoveryFromFault(wrapWithSolidisRequesterError(error));
        }
      });

      this.#scheduledRequests = undefined;
    });
  }

  async #createPipelineFromRequests() {
    if (this.#requests.length < 1) {
      return;
    }

    const pipelineChunks = this.#buildPipelineChunksFromRequests(
      this.#requests,
    );

    for (const pipelineChunk of pipelineChunks) {
      const expectedReplyCount = pipelineChunk.expectedReplyCount;
      const commandsBuffer = commandsToBuffer(pipelineChunk.pipelinedCommands);

      this.#debug?.(
        'debug',
        `Solidis requester serialized command: ${sanitizeCommandsBufferForDebug(commandsBuffer, pipelineChunk.pipelinedCommands)}`,
      );

      const pipelineRequest: SolidisPipelineRequest = {
        resolve: () => {},
        reject: (error: unknown) => {
          this.#rejectSubRequests(pipelineRequest, error);
        },
        commandsBuffer,
        subRequestIndex: 0,
        currentSubReplies: [],
        receivedReplyCount: 0,
        expectedReplyCount,
        subRequests: pipelineChunk.subRequests,
        subscribeCommandCount: pipelineChunk.subscribeCommandCount,
      };

      this.#pendingSubscribeCommandCount += pipelineChunk.subscribeCommandCount;

      this.#setRequestTimeout(pipelineRequest, 'set');
      this.#requestQueue.push(pipelineRequest);
    }

    this.#requests = [];

    await this.#flushRequestQueue();
  }

  async #flushRequestQueue() {
    this.#debug?.('debug', 'Solidis requester will flush queue.');

    while (this.#requestQueue.length > 0) {
      const request = this.#requestQueue.shift();

      if (!request) {
        return;
      }

      this.#inflightQueue.push(request);

      this.#debug?.(
        'debug',
        `Solidis requester will write pipeline: ${request.commandsBuffer.length} bytes`,
      );

      try {
        await this.#writeBufferToSocketInChunks(request.commandsBuffer);
      } catch (error: unknown) {
        this.recoveryFromFault(wrapWithSolidisRequesterError(error));
        break;
      }
    }
  }

  #setRequestTimeout(request: SolidisPipelineRequest, action: 'set' | 'clear') {
    if (action === 'set' && this.#options.commandTimeout > 0) {
      request.timeoutId = setTimeout(() => {
        request.isTimedOut = true;

        const timeoutError = new SolidisRequesterError(
          `Solidis command(s) timed out after ${this.#options.commandTimeout} ms.`,
        );

        this.#setRequestTimeout(request, 'clear');
        this.#rejectSubRequests(request, timeoutError);

        if (
          this.#inflightQueue.length > 0 &&
          this.#inflightQueue.every((inflight) => inflight.isTimedOut) &&
          this.#requestQueue.length === 0
        ) {
          this.recoveryFromFault(timeoutError);
        }
      }, this.#options.commandTimeout);
    }

    if (action === 'clear' && request.timeoutId) {
      clearTimeout(request.timeoutId);
    }
  }

  async #writeBufferToSocketInChunks(buffer: Buffer) {
    const { maxSocketWriteSizePerOnce } = this.#options;

    const eventHandlers = this.#getSocketWriteEventHandlers();

    try {
      let offset = 0;
      let isWritable = true;

      while (offset < buffer.length) {
        const chunk = extractNextChunkToWrite(
          buffer,
          offset,
          maxSocketWriteSizePerOnce,
        );

        if (!isWritable) {
          await eventHandlers.waitForDrain();
        }

        if (this.#isOnRecovery) {
          throw new SolidisRequesterError('Stale request: old session.');
        }

        isWritable = this.#writeChunkToSocket(chunk);
        offset += chunk.length;
      }
    } catch (error) {
      if (error instanceof SolidisRequesterError) {
        throw error;
      }

      throw new SolidisRequesterError('Socket write chunk error', error);
    } finally {
      eventHandlers.removeEventListeners();
    }

    if (eventHandlers.isError) {
      throw eventHandlers.error;
    }
  }

  #getSocketOrThrow() {
    const socket = this.#options.connection.socket;

    if (!socket) {
      throw new SolidisRequesterError('Socket is not connected');
    }

    return socket;
  }

  async #waitForSocketDrain(
    connectionTimeoutId: NodeJS.Timeout,
  ): Promise<void> {
    const socket = this.#getSocketOrThrow();

    return new Promise<void>((resolve) => {
      const drainTimeoutId = setTimeout(() => {
        socket.removeListener('drain', onDrain);

        resolve();
      }, this.#options.socketWriteTimeout);

      const onDrain = () => {
        clearTimeout(drainTimeoutId);
        clearTimeout(connectionTimeoutId);

        resolve();
      };

      socket.once('drain', onDrain);
    });
  }

  #getSocketWriteEventHandlers() {
    const socket = this.#getSocketOrThrow();

    const timeoutId = setTimeout(() => {
      handlers.isError = true;
      handlers.error = new SolidisRequesterError('Socket timed out');
    }, this.#options.socketWriteTimeout);

    const handlers: SolidisSocketWriteEventHandlers = {
      onError: (error: Error) => {
        handlers.isError = true;
        handlers.error = error;

        clearTimeout(timeoutId);
      },
      waitForDrain: () => this.#waitForSocketDrain(timeoutId),
      removeEventListeners: () => {
        socket.removeListener('error', handlers.onError);
        socket.removeListener('close', handlers.onError);

        clearTimeout(timeoutId);
      },
      isError: false,
      error: null,
    };

    socket.once('error', handlers.onError);
    socket.once('close', handlers.onError);

    return { ...handlers, socket };
  }

  #writeChunkToSocket(chunk: Buffer) {
    return this.#getSocketOrThrow().write(chunk);
  }

  #buildPipelineChunksFromRequests(
    requests: SolidisRequest[],
  ): SolidisPipelineRequestChunk[] {
    const { maxCommandsPerPipeline } = this.#options;

    const context: SolidisPipelineRequestChunkContext = {
      cursor: 0,
      chunks: [],
      pipelinedCommands: [],
      subRequests: [],
      subscribeCommandCount: 0,
    };

    for (const request of requests) {
      for (let index = 0; index < request.commands.length; index += 1) {
        if (context.pipelinedCommands.length >= maxCommandsPerPipeline) {
          this.#finalizePipelineChunkContext(context);
        }

        let command = request.commands[index];
        const isLastCommand = index === request.commands.length - 1;

        const isSubscribeFamily = this.#checkCommandIsSubscribeFamily(command);

        if (isSubscribeFamily) {
          command = this.#expandUnsubscribeAllCommand(command);
          context.subscribeCommandCount += 1;
        }

        const replySpan = this.#getCommandReplySpan(command, isSubscribeFamily);

        context.pipelinedCommands.push(command);
        context.subRequests.push({
          span: replySpan,
          resolve: (subReplies: SolidisData[]) => {
            request.replies.push(subReplies);

            if (isLastCommand) {
              request.resolve(request.replies);
            }
          },
          reject: (error: unknown) => {
            request.reject(error);
          },
        });

        context.cursor += replySpan;
      }
    }

    if (context.pipelinedCommands.length > 0) {
      this.#finalizePipelineChunkContext(context);
    }

    return context.chunks;
  }

  #checkCommandIsSubscribeFamily(command: StringOrBuffer[]) {
    const commandName = command[0];

    if (commandName === undefined) {
      return false;
    }

    const name =
      typeof commandName === 'string' ? commandName : commandName.toString();

    if (name.length < 9) {
      return false;
    }

    if (SolidisSubscribeCommandNameSet.has(name)) {
      return true;
    }

    return SolidisSubscribeCommandNameSet.has(name.toUpperCase());
  }

  #getCommandReplySpan(command: StringOrBuffer[], isSubscribeFamily: boolean) {
    if (!isSubscribeFamily) {
      return 1;
    }

    return Math.max(1, command.length - 1);
  }

  #expandUnsubscribeAllCommand(command: StringOrBuffer[]): StringOrBuffer[] {
    if (command.length !== 1) {
      return command;
    }

    const channels = this.#getUnsubscribeChannelSet(command[0]);

    if (!channels || channels.size === 0) {
      return command;
    }

    return [command[0], ...channels];
  }

  #getUnsubscribeChannelSet(
    commandName: StringOrBuffer,
  ): ReadonlySet<string> | undefined {
    const name = (
      typeof commandName === 'string' ? commandName : commandName.toString()
    ).toUpperCase();

    const { pubSub } = this.#options;

    switch (name) {
      case 'UNSUBSCRIBE': {
        return pubSub.subscribedChannels;
      }

      case 'SUNSUBSCRIBE': {
        return pubSub.subscribedShardChannels;
      }

      case 'PUNSUBSCRIBE': {
        return pubSub.subscribedPatterns;
      }

      default: {
        return undefined;
      }
    }
  }

  #finalizePipelineChunkContext(context: SolidisPipelineRequestChunkContext) {
    context.chunks.push({
      pipelinedCommands: context.pipelinedCommands,
      subRequests: context.subRequests,
      subscribeCommandCount: context.subscribeCommandCount,
      expectedReplyCount: context.cursor,
    });

    context.cursor = 0;
    context.pipelinedCommands = [];
    context.subRequests = [];
    context.subscribeCommandCount = 0;
  }

  public onReply(
    replyBuffer: Buffer,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    this.#replyBuffers.push(replyBuffer);

    if (!this.#scheduledReplies) {
      this.#scheduledReplies = setImmediate(() => {
        this.#scheduleReplies(emit);

        this.#scheduledReplies = undefined;
      });
    }
  }

  #scheduleReplies(emit: SolidisClientEventHandlers['emit']) {
    this.#replyLock = this.#replyLock.then(async () => {
      try {
        await this.#processReplies(emit);
      } catch (error: unknown) {
        emit('error', wrapWithSolidisRequesterError(error));
      }
    });
  }

  async #processReplies(emit: SolidisClientEventHandlers['emit']) {
    const {
      maxProcessRepliesPerChunk: maxReplyCount,
      maxProcessReplyBytesPerChunk: maxReplyBytes,
    } = this.#options;

    for (const { replyBuffers, shouldYield } of this.#chunkReplyBuffers(
      maxReplyBytes,
    )) {
      let parsedReplies: SolidisData[];

      try {
        parsedReplies = await this.#parser.queueParse(...replyBuffers);
      } catch (parserError: unknown) {
        emit('error', wrapWithParserError(parserError));

        this.recoveryFromFault(wrapWithParserError(parserError));

        return;
      }

      await this.#resolveRepliesInChunks(parsedReplies, maxReplyCount, emit);

      if (shouldYield) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
  }

  *#chunkReplyBuffers(
    maxBytes: number,
  ): Generator<{ replyBuffers: Buffer[]; shouldYield: boolean }> {
    const limit = Math.max(1, maxBytes);
    const replyBuffers = this.#replyBuffers.splice(0);

    let chunkBytes = 0;
    let chunk: Buffer[] = [];

    for (const replyBuffer of replyBuffers) {
      let offset = 0;

      while (offset < replyBuffer.length) {
        const remainingBytes = limit - chunkBytes;
        const nextSize = Math.min(replyBuffer.length - offset, remainingBytes);

        chunk.push(replyBuffer.subarray(offset, offset + nextSize));

        chunkBytes += nextSize;
        offset += nextSize;

        if (chunkBytes >= limit) {
          yield { replyBuffers: chunk, shouldYield: true };

          chunkBytes = 0;
          chunk = [];
        }
      }
    }

    if (chunk.length > 0) {
      yield { replyBuffers: chunk, shouldYield: false };
    }
  }

  async #resolveRepliesInChunks(
    parsedReplies: SolidisData[],
    maxChunkSize: number,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const length = parsedReplies.length;

    if (length === 0) {
      return;
    }

    if (length <= maxChunkSize) {
      this.#resolveReplies(parsedReplies, emit);

      return;
    }

    for (let index = 0; index < length; index += maxChunkSize) {
      const start = index;
      const end = Math.min(index + maxChunkSize, length);

      await new Promise<void>((resolve) => {
        setImmediate(() => {
          this.#resolveReplies(parsedReplies, emit, start, end);

          resolve();
        });
      });
    }
  }

  #resolveReplies(
    parsedReplies: SolidisData[],
    emit: SolidisClientEventHandlers['emit'],
    start = 0,
    end = parsedReplies.length,
  ) {
    for (let index = start; index < end; index += 1) {
      const reply = parsedReplies[index];

      if (this.#checkSkipForPubSubEvent(reply, emit)) {
        continue;
      }

      if (this.#inflightQueue.length < 1) {
        emit(
          'error',
          wrapWithSolidisRequesterError(
            'Received reply with no pending request',
          ),
        );

        continue;
      }

      try {
        this.#resolveSingleReply(reply);
      } catch (error: unknown) {
        throw wrapWithSolidisRequesterError(error);
      }
    }
  }

  #checkSkipForPubSubEvent(
    reply: SolidisData,
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const { pubSub } = this.#options;

    if (
      checkReplyIsArray(reply) &&
      this.#checkReplyCanBePubSubEvent(reply) &&
      checkReplyIsPubSubEvent(reply)
    ) {
      pubSub.dispatchPubSubEvent(reply, emit);

      if (checkReplyIsMessageEvent(reply)) {
        return true;
      }
    }

    return false;
  }

  #checkReplyCanBePubSubEvent(reply: SolidisData[]) {
    if (reply instanceof RespPush) {
      return true;
    }

    if (this.#negotiatedProtocol === SolidisProtocols.RESP3) {
      return false;
    }

    return (
      this.#options.pubSub.hasActiveSubscriptions ||
      this.#pendingSubscribeCommandCount > 0
    );
  }

  #resolveSingleReply(reply: SolidisData) {
    const request = this.#inflightQueue[0];

    if (!request) {
      return;
    }

    request.receivedReplyCount += 1;

    if (request.isTimedOut) {
      if (request.receivedReplyCount === request.expectedReplyCount) {
        this.#resolvePipelineRequest(request);
      }

      return;
    }

    const subRequest = request.subRequests[request.subRequestIndex];

    if (!subRequest) {
      return;
    }

    this.#processSubRequest(request, reply);

    if (request.receivedReplyCount === request.expectedReplyCount) {
      this.#resolvePipelineRequest(request);
    }
  }

  #processSubRequest(request: SolidisPipelineRequest, reply: SolidisData) {
    const subRequest = request.subRequests[request.subRequestIndex];

    if (!subRequest) {
      return;
    }

    if (subRequest.span === 1) {
      this.#resolveSubRequest(subRequest, [reply]);

      request.subRequestIndex += 1;

      return;
    }

    request.currentSubReplies.push(reply);

    if (request.currentSubReplies.length === subRequest.span) {
      this.#resolveSubRequest(subRequest, request.currentSubReplies);

      request.subRequestIndex += 1;
      request.currentSubReplies = [];
    }
  }

  #resolveSubRequest(
    subRequest: SolidisPipelineSubRequest,
    subReplies: SolidisData[],
  ) {
    const { rejectOnPartialPipelineError } = this.#options;

    if (!rejectOnPartialPipelineError) {
      subRequest.resolve(subReplies);

      return;
    }

    const foundErrorReply = findErrorInReplies(subReplies);

    if (foundErrorReply) {
      subRequest.reject(foundErrorReply);

      return;
    }

    subRequest.resolve(subReplies);
  }

  #shiftInflightRequest() {
    this.#inflightQueue.shift();
  }

  #resolvePipelineRequest(request: SolidisPipelineRequest) {
    this.#setRequestTimeout(request, 'clear');

    this.#pendingSubscribeCommandCount = Math.max(
      0,
      this.#pendingSubscribeCommandCount - request.subscribeCommandCount,
    );

    this.#shiftInflightRequest();
  }

  public recoveryFromFault(error: Error) {
    if (this.#isOnRecovery) {
      return;
    }

    this.#isOnRecovery = true;

    this.#requestLock = this.#requestLock.then(() => {
      this.#rejectAllRequests(error);
      this.#resetStates();

      this.#parser = new SolidisParser(this.#options);

      this.#options.connection.reset();

      this.#isOnRecovery = false;
    });
  }

  #rejectAllRequests(error: Error) {
    const requests = [...this.#requestQueue, ...this.#inflightQueue];

    for (const request of requests) {
      this.#setRequestTimeout(request, 'clear');

      request.reject(error);
    }

    for (const request of this.#requests) {
      request.reject(error);
    }
  }

  #rejectSubRequests(request: SolidisPipelineRequest, error: unknown) {
    if (request.subRequests) {
      for (const subRequest of request.subRequests) {
        subRequest.reject(error);
      }
    }
  }

  #resetStates() {
    this.#pendingSubscribeCommandCount = 0;

    this.#requestQueue = [];
    this.#inflightQueue = [];

    this.#requests = [];
    this.#replyBuffers = [];

    this.#scheduledReplies = undefined;
    this.#scheduledRequests = undefined;
  }
}
