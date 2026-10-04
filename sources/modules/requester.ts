import {
  RespError,
  SolidisClientError,
  SolidisRequesterError,
  wrapWithParserError,
  wrapWithSolidisConnectionError,
  wrapWithSolidisRequesterError,
} from '../common/utils/error.ts';
import {
  resolveTimerDelay,
  SolidisClientQuitMessage,
  SolidisSocketNotConnectedMessage,
} from '../common/utils/internal.ts';
import {
  getPubSubEventName,
  isMessageEventName,
  isSubscriptionEventName,
  isUnsubscribeEventName,
} from '../common/utils/reply.ts';
import {
  commandsToBuffer,
  getCommandName,
  toCommandError,
} from '../common/utils/request.ts';
import { RespPush } from '../types/resp.ts';
import { SolidisProtocols } from '../types/solidis.ts';
import {
  copyCommands,
  createRefusal,
  inspectCommand,
  SolidisSessionSendOptions,
} from './internal.ts';
import { SolidisParser } from './parser.ts';

import type {
  SolidisCommandKind,
  SolidisPipeline,
  SolidisRequest,
  SolidisSubRequest,
} from '../types/internal.ts';
import type {
  SolidisData,
  SolidisDebugHandle,
  SolidisRequesterOptions,
  SolidisSendOptions,
  StringOrBuffer,
} from '../types/solidis.ts';

const discardedExecCommand: StringOrBuffer[] = ['DISCARD'];

function rejectPipeline(pipeline: SolidisPipeline, error: unknown) {
  clearTimeout(pipeline.timer);

  for (const subRequest of pipeline.subRequests) {
    subRequest.request.reject(error);
  }
}

function createPipeline(): SolidisPipeline {
  return {
    commands: [],
    subRequests: [],
    subRequestIndex: 0,
    subReplies: [],
    timeout: 0,
    timer: undefined,
    receivedChunks: 0,
    writtenAt: 0,
    isBlocking: false,
    isTimedOut: false,
  };
}

export class SolidisRequester {
  readonly #options: SolidisRequesterOptions;
  readonly #debug?: SolidisDebugHandle;

  #parser: SolidisParser;
  #pendingRequests: SolidisRequest[] = [];
  #inflightQueue: SolidisPipeline[] = [];
  #inflightHead = 0;
  #timedOutCount = 0;
  #flushHandle: NodeJS.Immediate | undefined;
  #protocol: SolidisProtocols = SolidisProtocols.RESP2;
  #negotiatedProtocol: SolidisProtocols | undefined;
  #database: number;
  #authentication:
    | { username: StringOrBuffer; password: StringOrBuffer }
    | undefined;
  #transaction: SolidisSubRequest[] | undefined;
  #receivedChunks = 0;
  #isQueueing: boolean | undefined = false;
  #isQueueingLost = false;
  #isWatchingConfirmed = false;
  #isWatchLost = false;
  #hasWritten = false;

  constructor(options: SolidisRequesterOptions) {
    const { connection } = options;

    this.#options = options;
    this.#parser = new SolidisParser(options);
    this.#database = options.database;
    this.#debug = options.debugHandle;

    connection.on('data', (chunk) => this.#receive(chunk));
    connection.on('close', (error) => this.#fail(error));
    connection.on('end', () =>
      this.#fail(new SolidisClientError(SolidisClientQuitMessage)),
    );
  }

  public get protocol() {
    return this.#protocol;
  }

  public get negotiatedProtocol() {
    return this.#negotiatedProtocol;
  }

  public get database() {
    return this.#database;
  }

  public get authentication() {
    return this.#authentication;
  }

  public send(
    commands: StringOrBuffer[][],
    options?: SolidisSendOptions,
  ): Promise<SolidisData[][]> {
    const batch = copyCommands(commands);

    if (batch.length === 0) {
      return Promise.resolve([]);
    }

    const blockingTimeout = options?.blockingTimeout;
    const timeout = options?.timeout ?? this.#options.commandTimeout;

    return new Promise((resolve, reject) => {
      this.#pendingRequests.push({
        commands: batch,
        kinds: undefined,
        replies: new Array<SolidisData[]>(batch.length),
        resolve,
        reject,
        timeout:
          timeout <= 0 || blockingTimeout === 0
            ? 0
            : resolveTimerDelay(timeout + Math.max(0, blockingTimeout ?? 0)),
        isBlocking: blockingTimeout !== undefined,
        isSession: options === SolidisSessionSendOptions,
      });

      this.#flushHandle ??= setImmediate(() => this.#flush());
    });
  }

  #flush() {
    if (!this.#options.connection.isConnected) {
      this.#rejectPendingRequests(
        new SolidisRequesterError(SolidisSocketNotConnectedMessage),
      );

      return;
    }

    const requests = this.#pendingRequests;

    this.#flushHandle = undefined;
    this.#pendingRequests = [];

    const maxCommandsPerPipeline = Math.max(
      1,
      this.#options.maxCommandsPerPipeline,
    );

    let pipeline = createPipeline();

    try {
      for (const request of requests) {
        const refusal = this.#accept(request);

        if (refusal) {
          request.reject(refusal);

          continue;
        }

        if (
          pipeline.commands.length > 0 &&
          (request.isBlocking ||
            pipeline.isBlocking ||
            request.timeout !== pipeline.timeout)
        ) {
          this.#seal(pipeline);

          pipeline = createPipeline();
        }

        for (let index = 0; index < request.commands.length; index += 1) {
          if (pipeline.commands.length >= maxCommandsPerPipeline) {
            this.#seal(pipeline);

            pipeline = createPipeline();
          }

          const kind = request.kinds?.[index];
          const command = this.#expandCommand(
            request.commands[index],
            kind,
            pipeline,
          );

          pipeline.commands.push(command);
          pipeline.subRequests.push({
            request,
            command,
            kind,
            span: isSubscriptionEventName(kind) ? command.length - 1 : 1,
            index,
          });

          pipeline.timeout = request.timeout;
          pipeline.isBlocking ||= request.isBlocking;
        }
      }

      if (pipeline.commands.length > 0) {
        this.#seal(pipeline);
      }
    } catch (error) {
      const failure = wrapWithSolidisRequesterError(error);

      this.#options.connection.reset(failure);

      for (const request of requests) {
        request.reject(failure);
      }
    }
  }

  #accept(request: SolidisRequest) {
    const { commands } = request;

    let isQueueing = this.#isQueueing ?? this.#settle()[0];
    let isQueueingLost = this.#isQueueingLost;
    let isWatchLost = this.#isWatchLost;

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];

      let kind = inspectCommand(command, isQueueing);

      if (kind instanceof SolidisRequesterError) {
        return kind;
      }

      if (isQueueingLost && !request.isSession) {
        if (
          kind !== 'multi' &&
          kind !== 'exec' &&
          kind !== 'discard' &&
          kind !== 'reset'
        ) {
          return createRefusal(command, 'is refused after a lost MULTI.');
        }

        isQueueingLost = false;
        isWatchLost ||= kind === 'exec';
      }

      if (kind === null || kind === 'restricted') {
        continue;
      }

      if (kind === 'exec' && isWatchLost) {
        kind = 'discard';
        request.commands = [...commands];
        request.commands[index] = discardedExecCommand;
      }

      if (kind === 'multi') {
        isQueueing = true;
      } else if (kind === 'exec' || kind === 'discard' || kind === 'reset') {
        isQueueing = false;
        isWatchLost = false;
      } else if (!isQueueing && (kind === 'watch' || kind === 'unwatch')) {
        isWatchLost &&= kind === 'watch';
      }

      request.kinds ??= [];
      request.kinds[index] = kind;
    }

    this.#isQueueing = isQueueing;
    this.#isQueueingLost = isQueueingLost;
    this.#isWatchLost = isWatchLost;

    return undefined;
  }

  #settle(): [isQueueing: boolean, isWatching: boolean] {
    let isQueueing = this.#transaction !== undefined;
    let isWatching = this.#isWatchingConfirmed;

    for (const { subRequests, subRequestIndex } of this.#inflightQueue.slice(
      this.#inflightHead,
    )) {
      for (const { kind } of subRequests.slice(subRequestIndex)) {
        if (kind === 'multi') {
          isQueueing = true;
        } else if (kind === 'exec' || kind === 'discard' || kind === 'reset') {
          isQueueing = false;
          isWatching = false;
        } else if (!isQueueing && (kind === 'watch' || kind === 'unwatch')) {
          isWatching = kind === 'watch';
        }
      }
    }

    return [isQueueing, isWatching];
  }

  #expandCommand(
    command: StringOrBuffer[],
    kind: SolidisCommandKind | undefined,
    pipeline: SolidisPipeline,
  ) {
    if (command.length > 1 || !isUnsubscribeEventName(kind)) {
      return command;
    }

    const subscribeKind = kind.replace('un', '');
    const channels: StringOrBuffer[] =
      this.#options.pubSub.getSubscriptions(kind);

    for (const { subRequests } of [
      ...this.#inflightQueue.slice(this.#inflightHead),
      pipeline,
    ]) {
      for (const subRequest of subRequests) {
        if (subRequest.kind === subscribeKind) {
          for (let index = 1; index < subRequest.command.length; index += 1) {
            channels.push(subRequest.command[index]);
          }
        }
      }
    }

    return channels.length === 0 ? command : [command[0], ...channels];
  }

  #seal(pipeline: SolidisPipeline) {
    const buffer = commandsToBuffer(pipeline.commands);

    if (pipeline.timeout > 0) {
      pipeline.timer = setTimeout(
        () => this.#timeOut(pipeline),
        pipeline.timeout,
      );
    }

    this.#debug?.(
      'debug',
      `Requester serialized ${buffer.length} bytes: ${pipeline.commands.map(getCommandName).join(', ')}`,
    );

    pipeline.receivedChunks = this.#receivedChunks;
    pipeline.writtenAt = performance.now();

    this.#inflightQueue.push(pipeline);
    this.#options.connection.write(buffer);
    this.#hasWritten = true;
  }

  #receive(chunk: Buffer) {
    const parser = this.#parser;
    const replies: SolidisData[] = [];

    let failure: Error | undefined;

    this.#receivedChunks += 1;
    this.#debug?.('debug', `Requester received ${chunk.length} bytes`);

    try {
      parser.parse(chunk, replies);
    } catch (error) {
      failure = wrapWithParserError(error);
    }

    for (const reply of replies) {
      if (parser !== this.#parser) {
        return;
      }

      this.#route(reply);
    }

    if (failure && parser === this.#parser) {
      this.#options.emit('error', failure);
      this.#options.connection.reset(failure);
    }
  }

  #route(reply: SolidisData) {
    if (Array.isArray(reply)) {
      const { pubSub } = this.#options;
      const isPush = reply instanceof RespPush;
      const isEvent =
        isPush ||
        (this.#protocol === SolidisProtocols.RESP2 &&
          pubSub.hasActiveSubscriptions);
      const pipeline = this.#inflightQueue[this.#inflightHead];
      const kind = pipeline?.subRequests[pipeline.subRequestIndex].kind;
      const confirmation = isSubscriptionEventName(kind) ? kind : undefined;

      if (isEvent || confirmation) {
        const eventName = getPubSubEventName(reply);

        if (!eventName) {
          if (isPush) {
            pubSub.dispatchPush(reply);

            return;
          }
        } else if (eventName === confirmation) {
          this.#resolveNext(reply);
          pubSub.dispatchSubscriptionChange(confirmation, reply);

          return;
        } else if (isEvent) {
          if (isMessageEventName(eventName)) {
            pubSub.dispatchMessage(eventName, reply);
          } else {
            pubSub.dispatchSubscriptionChange(eventName, reply);
          }

          return;
        }
      }
    }

    this.#resolveNext(reply);
  }

  #resolveNext(reply: SolidisData) {
    const pipeline = this.#inflightQueue[this.#inflightHead];

    if (!pipeline) {
      if (
        reply instanceof RespError &&
        !this.#hasWritten &&
        this.#pendingRequests.length > 0
      ) {
        this.#rejectPendingRequests(wrapWithSolidisConnectionError(reply));
      } else {
        this.#options.emit(
          'error',
          new SolidisRequesterError(
            'Received reply with no pending request',
            reply,
          ),
        );
      }

      return;
    }

    const subRequest = pipeline.subRequests[pipeline.subRequestIndex];

    let replies = [reply];

    if (subRequest.span > 1) {
      pipeline.subReplies.push(reply);

      if (
        pipeline.subReplies.length < subRequest.span &&
        !(reply instanceof RespError)
      ) {
        return;
      }

      replies = pipeline.subReplies;
      pipeline.subReplies = [];
    }

    pipeline.subRequestIndex += 1;

    if (pipeline.subRequestIndex === pipeline.subRequests.length) {
      clearTimeout(pipeline.timer);

      if (pipeline.isTimedOut) {
        this.#timedOutCount -= 1;
      }

      this.#inflightHead += 1;

      if (this.#inflightHead * 2 >= this.#inflightQueue.length) {
        this.#inflightQueue.splice(0, this.#inflightHead);
        this.#inflightHead = 0;
      }
    }

    this.#complete(subRequest, replies);
  }

  #complete(subRequest: SolidisSubRequest, replies: SolidisData[]) {
    const { request } = subRequest;

    if (this.#transaction && replies[0] === 'QUEUED') {
      this.#transaction.push(subRequest);
    } else if (subRequest.kind !== undefined) {
      this.#track(subRequest, replies[0]);
    }

    const result =
      subRequest.command === discardedExecCommand ? [null] : replies;
    const error =
      this.#options.rejectOnPartialPipelineError &&
      result.find((reply): reply is RespError => reply instanceof RespError);

    request.replies[subRequest.index] = result;

    if (error) {
      request.reject(toCommandError(error, subRequest.command));
    } else if (subRequest.index === request.replies.length - 1) {
      request.resolve(request.replies);
    }
  }

  #track({ command, kind }: SolidisSubRequest, reply: SolidisData) {
    const argument = command[1];

    if (reply instanceof RespError && reply.code !== 'EXECABORT') {
      this.#isQueueing = undefined;

      return;
    }

    if (kind === 'exec' || kind === 'discard') {
      const queued = this.#transaction;

      this.#transaction = undefined;
      this.#isWatchingConfirmed = false;

      if (Array.isArray(reply)) {
        queued?.forEach((subRequest, index) => {
          this.#track(subRequest, reply[index]);
        });
      }

      return;
    }

    if (kind === 'multi') {
      this.#transaction = [];
    } else if (kind === 'watch' || kind === 'unwatch') {
      this.#isWatchingConfirmed = kind === 'watch';
    } else if (kind === 'select') {
      this.#database = Number(argument);
    } else if (kind === 'auth') {
      this.#authentication = {
        username: command.length > 2 ? argument : 'default',
        password: command[command.length - 1],
      };
    } else if (kind === 'hello' && argument !== undefined) {
      this.#protocol =
        String(argument) === '3'
          ? SolidisProtocols.RESP3
          : SolidisProtocols.RESP2;
      this.#negotiatedProtocol = this.#protocol;

      for (let index = 2; index < command.length; index += 2) {
        if (String(command[index]).toUpperCase() === 'AUTH') {
          this.#authentication = {
            username: command[index + 1],
            password: command[index + 2],
          };

          index += 1;
        }
      }
    } else if (kind === 'reset') {
      this.#protocol = SolidisProtocols.RESP2;
      this.#negotiatedProtocol = undefined;
      this.#database = 0;
      this.#authentication = undefined;
      this.#transaction = undefined;
      this.#isWatchingConfirmed = false;

      this.#options.pubSub.clear();
    }
  }

  #timeOut(pipeline: SolidisPipeline) {
    const { commandTimeout } = this.#options;
    const queue = this.#inflightQueue;
    const error = new SolidisRequesterError(
      `Command(s) timed out after ${pipeline.timeout} ms.`,
    );

    let isStalled =
      commandTimeout > 0 &&
      performance.now() - queue[this.#inflightHead].writtenAt >=
        commandTimeout &&
      pipeline.receivedChunks === this.#receivedChunks &&
      queue[this.#inflightHead] !== pipeline;

    for (
      let index = this.#inflightHead;
      isStalled && queue[index] !== pipeline;
      index += 1
    ) {
      isStalled = queue[index].isTimedOut;
    }

    pipeline.isTimedOut = true;
    this.#timedOutCount += 1;

    rejectPipeline(pipeline, error);

    if (
      pipeline.isBlocking ||
      isStalled ||
      this.#timedOutCount === queue.length - this.#inflightHead
    ) {
      this.#options.connection.reset(
        new SolidisRequesterError(
          'Connection reset because a command timed out.',
          error,
        ),
      );
    }
  }

  #rejectPendingRequests(error: Error) {
    const requests = this.#pendingRequests;

    clearImmediate(this.#flushHandle);

    this.#flushHandle = undefined;
    this.#pendingRequests = [];

    for (const request of requests) {
      request.reject(error);
    }
  }

  #fail(error: Error) {
    const pipelines = this.#inflightQueue.slice(this.#inflightHead);
    const [isQueueing, isWatching] = this.#settle();

    this.#inflightQueue = [];
    this.#inflightHead = 0;
    this.#timedOutCount = 0;
    this.#parser = new SolidisParser(this.#options);
    this.#protocol = SolidisProtocols.RESP2;
    this.#transaction = undefined;
    this.#isQueueingLost ||= isQueueing;
    this.#isQueueing = false;
    this.#isWatchLost ||= isWatching;
    this.#isWatchingConfirmed = false;
    this.#hasWritten = false;

    for (const pipeline of pipelines) {
      rejectPipeline(pipeline, error);
    }

    this.#rejectPendingRequests(error);
  }
}
