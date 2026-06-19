import {
  checkReplyIsArray,
  checkReplyIsMessageEvent,
  checkReplyIsPubSubEvent,
  commandsToBuffer,
  findErrorInReplies,
  generateDebugHandle,
  RespPush,
  SolidisParser,
  SolidisProtocols,
  SolidisPubSubEventNames,
  SolidisRequesterError,
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
  SolidisRequest,
  SolidisRequesterOptions,
  SolidisSocketWriteEventHandlers,
  StringOrBuffer,
} from '../index.ts';

const SolidisSubscribeCommandNameSet = new Set(
  SolidisPubSubEventNames.slice(3).map((name) => name.toUpperCase()),
);

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
        `Requester serialized: ${sanitizeCommandsBufferForDebug(commandsBuffer, pipelineChunk.pipelinedCommands)}`,
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
    this.#debug?.('debug', 'Requester will flush queue.');

    while (this.#requestQueue.length > 0) {
      const request = this.#requestQueue.shift();

      if (!request) {
        return;
      }

      this.#inflightQueue.push(request);

      this.#debug?.(
        'debug',
        `Requester will write: ${request.commandsBuffer.length} bytes`,
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
          `Command(s) timed out after ${this.#options.commandTimeout} ms.`,
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
        const endOffset = Math.min(
          offset + maxSocketWriteSizePerOnce,
          buffer.length,
        );
        const chunk = buffer.subarray(offset, endOffset);

        if (!isWritable) {
          await eventHandlers.waitForDrain();
        }

        if (this.#isOnRecovery) {
          throw new SolidisRequesterError('Stale request: old session.');
        }

        const socket = this.#options.connection.socket;

        if (!socket) {
          throw new SolidisRequesterError('Socket is not connected');
        }

        isWritable = socket.write(chunk);
        offset = endOffset;
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

  #getSocketWriteEventHandlers() {
    const socket = this.#options.connection.socket;

    if (!socket) {
      throw new SolidisRequesterError('Socket is not connected');
    }
    const { socketWriteTimeout } = this.#options;

    const timeoutId = setTimeout(() => {
      handlers.isError = true;
      handlers.error = new SolidisRequesterError('Socket timed out');
    }, socketWriteTimeout);

    const onClose = (hadError: boolean) => {
      handlers.onError(
        new SolidisRequesterError(
          `Socket closed${hadError ? ' due to a transmission error' : ''}`,
        ),
      );
    };

    const handlers: SolidisSocketWriteEventHandlers = {
      onError: (error: Error) => {
        handlers.isError = true;
        handlers.error = error;

        clearTimeout(timeoutId);
      },
      waitForDrain: () =>
        new Promise<void>((resolve) => {
          const drainTimeoutId = setTimeout(() => {
            cleanup();
            resolve();
          }, socketWriteTimeout);

          const cleanup = () => {
            socket.removeListener('drain', onDrain);
            socket.removeListener('error', onSocketFault);
            socket.removeListener('close', onSocketFault);
          };

          const onDrain = () => {
            clearTimeout(drainTimeoutId);
            clearTimeout(timeoutId);
            cleanup();
            resolve();
          };

          const onSocketFault = () => {
            clearTimeout(drainTimeoutId);
            cleanup();
            resolve();
          };

          socket.once('drain', onDrain);
          socket.once('error', onSocketFault);
          socket.once('close', onSocketFault);
        }),
      removeEventListeners: () => {
        socket.removeListener('error', handlers.onError);
        socket.removeListener('close', onClose);

        clearTimeout(timeoutId);
      },
      isError: false,
      error: null,
    };

    socket.once('error', handlers.onError);
    socket.once('close', onClose);

    return handlers;
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

        const expandedCommand = this.#processSubscribeCommand(command);

        if (expandedCommand) {
          command = expandedCommand;
          context.subscribeCommandCount += 1;
        }

        const replySpan = expandedCommand ? Math.max(1, command.length - 1) : 1;

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

  #processSubscribeCommand(command: StringOrBuffer[]): StringOrBuffer[] | null {
    const commandName = command[0];

    if (commandName === undefined) {
      return null;
    }

    const commandNameString =
      typeof commandName === 'string' ? commandName : commandName.toString();

    if (commandNameString.length < 9) {
      return null;
    }

    const upper = SolidisSubscribeCommandNameSet.has(commandNameString)
      ? commandNameString
      : commandNameString.toUpperCase();

    if (!SolidisSubscribeCommandNameSet.has(upper)) {
      return null;
    }

    if (command.length !== 1) {
      return command;
    }

    const channels =
      this.#options.pubSub.getChannelsForUnsubscribeCommand(upper);

    if (!channels || channels.size === 0) {
      return command;
    }

    return [command[0], ...channels];
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
        const wrappedParserError = wrapWithParserError(parserError);

        emit('error', wrappedParserError);

        this.recoveryFromFault(wrappedParserError);

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

    if (length <= maxChunkSize) {
      this.#resolveReplies(parsedReplies, emit);

      return;
    }

    for (let index = 0; index < length; index += maxChunkSize) {
      await new Promise<void>((resolve) => {
        setImmediate(() => {
          this.#resolveReplies(
            parsedReplies,
            emit,
            index,
            Math.min(index + maxChunkSize, length),
          );

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

    let subReplies: SolidisData[];

    if (subRequest.span === 1) {
      subReplies = [reply];
      request.subRequestIndex += 1;
    } else {
      request.currentSubReplies.push(reply);

      if (request.currentSubReplies.length < subRequest.span) {
        return;
      }

      subReplies = request.currentSubReplies;
      request.subRequestIndex += 1;
      request.currentSubReplies = [];
    }

    const foundErrorReply =
      this.#options.rejectOnPartialPipelineError &&
      findErrorInReplies(subReplies);

    if (foundErrorReply) {
      subRequest.reject(foundErrorReply);
    } else {
      subRequest.resolve(subReplies);
    }

    if (request.receivedReplyCount === request.expectedReplyCount) {
      this.#resolvePipelineRequest(request);
    }
  }

  #resolvePipelineRequest(request: SolidisPipelineRequest) {
    this.#setRequestTimeout(request, 'clear');

    this.#pendingSubscribeCommandCount = Math.max(
      0,
      this.#pendingSubscribeCommandCount - request.subscribeCommandCount,
    );

    this.#inflightQueue.shift();
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

    if (this.#scheduledReplies) {
      clearImmediate(this.#scheduledReplies);
    }

    if (this.#scheduledRequests) {
      clearImmediate(this.#scheduledRequests);
    }

    this.#scheduledReplies = undefined;
    this.#scheduledRequests = undefined;
  }
}
