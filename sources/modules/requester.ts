import {
  checkReplyIsArray,
  checkReplyIsMessageEvent,
  checkReplyIsPubSubEvent,
  commandsToBuffer,
  extractNextChunkToWrite,
  extractSubReplies,
  findErrorInReplies,
  generateDebugHandle,
  SolidisParser,
  SolidisRequesterError,
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

  #sessionId = 0;

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

  #debug?: (type: SolidisDebugLogType, message: string, data?: unknown) => void;

  constructor(options: SolidisRequesterOptions) {
    this.#options = options;
    this.#parser = new SolidisParser(options);

    this.#debug = generateDebugHandle(options.debugMemory);
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
      const expectedReplyCount = pipelineChunk.pipelinedCommands.length;
      const commandsBuffer = commandsToBuffer(pipelineChunk.pipelinedCommands);

      this.#debug?.(
        'debug',
        `Solidis requester serialized command: ${commandsBuffer.toString()}`,
      );

      const pipelineRequest: SolidisPipelineRequest = {
        sessionId: this.#sessionId,
        resolve: () => {},
        reject: (error: unknown) => {
          this.#rejectSubRequests(pipelineRequest, error);
        },
        commandsBuffer,
        parsedReplies: [],
        expectedReplyCount,
        subRequests: pipelineChunk.subRequests,
      };

      this.#setRequestTimeout(pipelineRequest, 'set');
      this.#requestQueue.push(pipelineRequest);
    }

    this.#requests = [];

    await this.#flushRequestQueue();
  }

  async #flushRequestQueue() {
    const sessionId = this.#sessionId;

    this.#debug?.('debug', 'Solidis requester will flush queue.');

    while (this.#requestQueue.length > 0) {
      const request = this.#requestQueue.shift();

      if (!request) {
        return;
      }

      if (request.sessionId !== sessionId) {
        request.reject(
          new SolidisRequesterError('Stale request: old session.'),
        );

        continue;
      }

      this.#inflightQueue.push(request);

      this.#debug?.(
        'debug',
        `Solidis requester will write pipeline: ${request.commandsBuffer}`,
      );

      try {
        await this.#writeBufferToSocketInChunks(
          request.commandsBuffer,
          sessionId,
        );
      } catch (error: unknown) {
        this.recoveryFromFault(wrapWithSolidisRequesterError(error));
        break;
      }
    }
  }

  #setRequestTimeout(request: SolidisPipelineRequest, action: 'set' | 'clear') {
    if (action === 'set' && this.#options.commandTimeout > 0) {
      request.timeoutId = setTimeout(() => {
        if (request.sessionId !== this.#sessionId) {
          return;
        }

        this.recoveryFromFault(
          new SolidisRequesterError(
            `Solidis command(s) timed out after ${this.#options.commandTimeout} ms.`,
          ),
        );
      }, this.#options.commandTimeout);
    }

    if (action === 'clear' && request.timeoutId) {
      clearTimeout(request.timeoutId);
    }
  }

  async #writeBufferToSocketInChunks(buffer: Buffer, sessionId: number) {
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

        if (this.#isOnRecovery || sessionId !== this.#sessionId) {
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
    };

    for (const request of requests) {
      for (let index = 0; index < request.commands.length; index += 1) {
        if (context.pipelinedCommands.length >= maxCommandsPerPipeline) {
          this.#finalizePipelineChunkContext(context);
        }

        const isLastCommand = index === request.commands.length - 1;

        context.pipelinedCommands.push(request.commands[index]);
        context.subRequests.push({
          cursor: context.cursor,
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

        context.cursor += 1;
      }
    }

    if (context.pipelinedCommands.length > 0) {
      this.#finalizePipelineChunkContext(context);
    }

    return context.chunks;
  }

  #finalizePipelineChunkContext(context: SolidisPipelineRequestChunkContext) {
    context.chunks.push({
      pipelinedCommands: context.pipelinedCommands,
      subRequests: context.subRequests,
    });

    context.cursor = 0;
    context.pipelinedCommands = [];
    context.subRequests = [];
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

  async #scheduleReplies(emit: SolidisClientEventHandlers['emit']) {
    this.#replyLock = this.#replyLock.then(() => {
      this.#processReplies(emit);

      this.#replyBuffers = [];
    });
  }

  async #processReplies(emit: SolidisClientEventHandlers['emit']) {
    const { maxProcessRepliesPerChunk: maxChunkSize } = this.#options;

    let parsedReplies: SolidisData[];

    try {
      parsedReplies = await this.#parser.queueParse(...this.#replyBuffers);
    } catch (parserError: unknown) {
      emit('error', wrapWithParserError(parserError));

      return;
    }

    const length = parsedReplies.length;

    if (length === 0) {
      return;
    }

    if (length <= maxChunkSize) {
      this.#resolveReplies(parsedReplies, emit);

      return;
    }

    for (let index = 0; index < length; index += maxChunkSize) {
      const chunk = parsedReplies.slice(index, index + maxChunkSize);

      setImmediate(() => {
        this.#resolveReplies(chunk, emit);
      });
    }
  }

  #resolveReplies(
    parsedReplies: SolidisData[],
    emit: SolidisClientEventHandlers['emit'],
  ) {
    while (parsedReplies.length > 0) {
      if (this.#checkSkipForPubSubEvent(parsedReplies, emit)) {
        continue;
      }

      if (this.#inflightQueue.length < 1) {
        parsedReplies.shift();

        continue;
      }

      try {
        this.#resolveSingleReply(parsedReplies);
      } catch (error: unknown) {
        throw wrapWithSolidisRequesterError(error);
      }
    }
  }

  #checkSkipForPubSubEvent(
    parsedReplies: SolidisData[],
    emit: SolidisClientEventHandlers['emit'],
  ) {
    const { pubSub } = this.#options;

    const reply = parsedReplies[0];

    if (checkReplyIsArray(reply) && checkReplyIsPubSubEvent(reply)) {
      pubSub.dispatchPubSubEvent(reply, emit);

      if (checkReplyIsMessageEvent(reply)) {
        parsedReplies.shift();

        return true;
      }
    }

    return false;
  }

  #resolveSingleReply(parsedReplies: SolidisData[]) {
    const request = this.#inflightQueue[0];
    const reply = parsedReplies.shift();

    if (request.sessionId !== this.#sessionId) {
      return;
    }

    if (typeof reply !== 'undefined') {
      request.parsedReplies.push(reply);
    }

    if (request.parsedReplies.length === request.expectedReplyCount) {
      this.#resolvePipelineRequest(request);
    }
  }

  #shiftInflightRequest() {
    this.#inflightQueue.shift();
  }

  #resolvePipelineRequest(request: SolidisPipelineRequest) {
    this.#setRequestTimeout(request, 'clear');

    if (request.sessionId !== this.#sessionId) {
      return;
    }

    this.#resolveSubRequests(request);

    this.#shiftInflightRequest();
  }

  #resolveSubRequests(request: SolidisPipelineRequest) {
    const { parsedReplies } = request;

    for (const subRequest of request.subRequests) {
      const subReplies = extractSubReplies(parsedReplies, subRequest);

      this.#resolveSubRequest(subRequest, subReplies);
    }
  }

  #resolveSubRequest(
    subRequest: SolidisPipelineSubRequest,
    subReplies: SolidisData[],
  ) {
    const { rejectOnPartialPipelineError } = this.#options;

    const foundErrorReply = findErrorInReplies(subReplies);

    if (foundErrorReply && rejectOnPartialPipelineError) {
      subRequest.reject(foundErrorReply);

      return;
    }

    subRequest.resolve(subReplies);
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

      this.#isOnRecovery = false;
    });
  }

  #rejectAllRequests(error: Error) {
    const requests = [...this.#requestQueue, ...this.#inflightQueue];

    for (const request of requests) {
      this.#setRequestTimeout(request, 'clear');
      this.#rejectSubRequests(request, error);

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
    this.#sessionId += 1;

    this.#requestQueue = [];
    this.#inflightQueue = [];

    this.#requests = [];
    this.#replyBuffers = [];

    this.#scheduledReplies = undefined;
    this.#scheduledRequests = undefined;
  }
}
