import {
  SolidisMaximumTimerDelay,
  SolidisSocketNotConnectedMessage,
} from '../common/internal.ts';
import {
  generateDebugHandle,
  sanitizeCommandsBufferForDebug,
} from '../common/utils/debug.ts';
import {
  RespError,
  SolidisClientError,
  SolidisRequesterError,
  wrapWithParserError,
} from '../common/utils/error.ts';
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
  SolidisCommandKinds,
  SolidisUnsupportedCommandNameSet,
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
  SolidisDebugLogType,
  SolidisRequesterOptions,
  SolidisSendOptions,
  StringOrBuffer,
} from '../types/solidis.ts';

const pairingReason = 'it breaks the pairing of requests and replies.';

const discardedExecCommand: StringOrBuffer[] = ['DISCARD'];

const commandKindCacheLimit = 1024;
const commandKindCache = new Map<string, SolidisCommandKind | null>();

function classifyCommand(command: StringOrBuffer[]) {
  const name = command[0];
  const text = typeof name === 'string' ? name : name.toString('latin1');

  let kind = commandKindCache.get(text);

  if (kind === undefined) {
    kind = SolidisCommandKinds.get(text.toUpperCase()) ?? null;

    if (commandKindCache.size < commandKindCacheLimit) {
      commandKindCache.set(text, kind);
    }
  }

  return kind;
}

function isUnsupported(command: StringOrBuffer[]) {
  const words = command
    .slice(0, 3)
    .map((word) => String(word).split('\0', 1)[0].toUpperCase());

  return [1, 2, 3].some((length) =>
    SolidisUnsupportedCommandNameSet.has(words.slice(0, length).join(' ')),
  );
}

function createRefusal(command: StringOrBuffer[], reason: string) {
  return new SolidisRequesterError(`${getCommandName(command)} ${reason}`);
}

function resolveTimeout(commandTimeout: number, blockingTimeout?: number) {
  const timeout = commandTimeout + Math.max(0, blockingTimeout ?? 0);

  if (
    commandTimeout <= 0 ||
    blockingTimeout === 0 ||
    timeout > SolidisMaximumTimerDelay
  ) {
    return 0;
  }

  return timeout;
}

function getReplySpan(
  command: StringOrBuffer[],
  kind: SolidisCommandKind | undefined,
) {
  if (!isSubscriptionEventName(kind)) {
    return 1;
  }

  return Math.max(1, command.length - 1);
}

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
    isBlocking: false,
    isTimedOut: false,
  };
}

export class SolidisRequester {
  readonly #options: SolidisRequesterOptions;
  readonly #debug?: (
    type: SolidisDebugLogType,
    message: string,
    data?: unknown,
  ) => void;

  #parser: SolidisParser;
  #pendingRequests: SolidisRequest[] = [];
  #inflightQueue: SolidisPipeline[] = [];
  #flushHandle: NodeJS.Immediate | undefined;
  #protocol: SolidisProtocols = SolidisProtocols.RESP2;
  #database: number;
  #authentication:
    | { username: StringOrBuffer; password: StringOrBuffer }
    | undefined;
  #transaction: SolidisSubRequest[] | undefined;
  #receivedChunks = 0;
  #isQueueing = false;
  #isWatching = false;
  #isWatchLost = false;

  constructor(options: SolidisRequesterOptions) {
    const { connection } = options;

    this.#options = options;
    this.#parser = new SolidisParser(options);
    this.#database = options.database;
    this.#debug = generateDebugHandle(options.debugMemory);

    connection.on('data', (chunk) => this.#receive(chunk));
    connection.on('close', (error) => this.#fail(error));
    connection.on('end', () =>
      this.#fail(new SolidisClientError('The client was quit.')),
    );
  }

  public get protocol() {
    return this.#protocol;
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
    if (commands.length === 0) {
      return Promise.resolve([]);
    }

    const blockingTimeout = options?.blockingTimeout;

    return new Promise((resolve, reject) => {
      this.#pendingRequests.push({
        commands,
        kinds: undefined,
        replies: new Array<SolidisData[]>(commands.length),
        resolve,
        reject,
        timeout: resolveTimeout(
          options?.timeout ?? this.#options.commandTimeout,
          blockingTimeout,
        ),
        isBlocking: blockingTimeout !== undefined,
      });

      this.#flushHandle ??= setImmediate(() => this.#flush());
    });
  }

  #flush() {
    const requests = this.#pendingRequests;

    this.#flushHandle = undefined;
    this.#pendingRequests = [];

    if (!this.#options.connection.isConnected) {
      const error = new SolidisRequesterError(SolidisSocketNotConnectedMessage);

      for (const request of requests) {
        request.reject(error);
      }

      return;
    }

    const maxCommandsPerPipeline = Math.max(
      1,
      this.#options.maxCommandsPerPipeline,
    );

    let pipeline = createPipeline();

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
          span: getReplySpan(command, kind),
          index,
        });
        pipeline.timeout = request.timeout;
        pipeline.isBlocking ||= request.isBlocking;
      }
    }

    if (pipeline.commands.length > 0) {
      this.#seal(pipeline);
    }
  }

  #accept(request: SolidisRequest) {
    const { commands } = request;

    let isQueueing = this.#isQueueing;
    let isWatching = this.#isWatching;
    let isWatchLost = this.#isWatchLost;

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];

      if (command.length === 0) {
        return new SolidisRequesterError('Cannot send an empty command.');
      }

      for (const argument of command) {
        if (typeof argument !== 'string' && !Buffer.isBuffer(argument)) {
          return createRefusal(command, 'takes only strings and Buffers.');
        }
      }

      let kind = classifyCommand(command);

      if (kind === null) {
        continue;
      }

      if (kind === 'restricted') {
        if (isUnsupported(command)) {
          return createRefusal(command, `is not supported: ${pairingReason}`);
        }

        continue;
      }

      if (isQueueing && isSubscriptionEventName(kind)) {
        return createRefusal(
          command,
          `is not supported inside a transaction: ${pairingReason}`,
        );
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
        isWatching = false;
        isWatchLost = false;
      } else if (!isQueueing && (kind === 'watch' || kind === 'unwatch')) {
        isWatching = kind === 'watch';
        isWatchLost = false;
      }

      request.kinds ??= [];
      request.kinds[index] = kind;
    }

    this.#isQueueing = isQueueing;
    this.#isWatching = isWatching;
    this.#isWatchLost = isWatchLost;

    return undefined;
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

    for (const { subRequests } of [...this.#inflightQueue, pipeline]) {
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
      `Requester serialized: ${sanitizeCommandsBufferForDebug(buffer, pipeline.commands)}`,
    );

    pipeline.receivedChunks = this.#receivedChunks;

    this.#inflightQueue.push(pipeline);
    this.#options.connection.write(buffer);
  }

  #receive(chunk: Buffer) {
    const parser = this.#parser;

    let replies: SolidisData[];

    this.#receivedChunks += 1;
    this.#debug?.('debug', `Requester received ${chunk.length} bytes`);

    try {
      replies = parser.parse(chunk);
    } catch (error) {
      const parserError = wrapWithParserError(error);

      this.#options.emit('error', parserError);
      this.#options.connection.reset(parserError);

      return;
    }

    for (const reply of replies) {
      if (parser !== this.#parser) {
        return;
      }

      this.#route(reply);
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
      const confirmation = this.#getExpectedConfirmation();

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
          } else if (isSubscriptionEventName(eventName)) {
            pubSub.dispatchSubscriptionChange(eventName, reply);
          }

          return;
        }
      }
    }

    this.#resolveNext(reply);
  }

  #getExpectedConfirmation() {
    const pipeline = this.#inflightQueue[0];
    const kind = pipeline?.subRequests[pipeline.subRequestIndex].kind;

    return isSubscriptionEventName(kind) ? kind : undefined;
  }

  #resolveNext(reply: SolidisData) {
    const pipeline = this.#inflightQueue[0];

    if (!pipeline) {
      this.#options.emit(
        'error',
        new SolidisRequesterError('Received reply with no pending request'),
      );

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

      this.#inflightQueue.shift();
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

    request.replies[subRequest.index] =
      subRequest.command === discardedExecCommand ? [null] : replies;

    const error =
      this.#options.rejectOnPartialPipelineError &&
      replies.find((reply): reply is RespError => reply instanceof RespError);

    if (error) {
      request.reject(toCommandError(error, subRequest.command));
    } else if (subRequest.index === request.replies.length - 1) {
      request.resolve(request.replies);
    }
  }

  #track({ command, kind }: SolidisSubRequest, reply: SolidisData) {
    const argument = command[1];

    if (kind === 'exec' || kind === 'discard') {
      const queued = this.#transaction;

      this.#transaction = undefined;

      if (Array.isArray(reply)) {
        queued?.forEach((subRequest, index) => {
          this.#track(subRequest, reply[index]);
        });
      }

      return;
    }

    if (reply instanceof RespError) {
      return;
    }

    if (kind === 'multi') {
      this.#transaction = [];
    } else if (kind === 'select') {
      this.#database = Number(argument);
    } else if (kind === 'auth') {
      this.#authenticate(
        command.length > 2 ? argument : 'default',
        command[command.length - 1],
      );
    } else if (kind === 'hello' && argument !== undefined) {
      this.#protocol =
        String(argument) === '3'
          ? SolidisProtocols.RESP3
          : SolidisProtocols.RESP2;

      if (String(command[2]).toUpperCase() === 'AUTH') {
        this.#authenticate(command[3], command[4]);
      }
    } else if (kind === 'reset') {
      this.#protocol = SolidisProtocols.RESP2;
      this.#database = 0;
      this.#authentication = undefined;
      this.#transaction = undefined;

      this.#options.pubSub.clear();
    }
  }

  #authenticate(username: StringOrBuffer, password: StringOrBuffer) {
    this.#authentication = { username, password };
  }

  #timeOut(pipeline: SolidisPipeline) {
    const queue = this.#inflightQueue;
    const previous = queue.slice(0, queue.indexOf(pipeline));
    const error = new SolidisRequesterError(
      `Command(s) timed out after ${pipeline.timeout} ms.`,
    );
    const isStalled =
      pipeline.timeout >= this.#options.commandTimeout &&
      pipeline.receivedChunks === this.#receivedChunks &&
      previous.length > 0 &&
      previous.every((inflight) => inflight.isTimedOut);

    pipeline.isTimedOut = true;

    rejectPipeline(pipeline, error);

    if (
      pipeline.isBlocking ||
      isStalled ||
      queue.every((inflight) => inflight.isTimedOut)
    ) {
      this.#options.connection.reset(
        new SolidisRequesterError(
          'Connection reset because a command timed out.',
          error,
        ),
      );
    }
  }

  #fail(error: Error) {
    const pipelines = this.#inflightQueue;
    const requests = this.#pendingRequests;

    clearImmediate(this.#flushHandle);

    this.#flushHandle = undefined;
    this.#pendingRequests = [];
    this.#inflightQueue = [];
    this.#parser = new SolidisParser(this.#options);
    this.#protocol = SolidisProtocols.RESP2;
    this.#transaction = undefined;
    this.#isQueueing = false;
    this.#isWatchLost ||= this.#isWatching;
    this.#isWatching = false;

    for (const pipeline of pipelines) {
      rejectPipeline(pipeline, error);
    }

    for (const request of requests) {
      request.reject(error);
    }
  }
}
