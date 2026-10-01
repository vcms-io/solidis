import { SolidisCommandKinds } from '../common/constants.ts';
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
  findErrorInReplies,
  getPubSubEventName,
  isMessageEventName,
  isSubscriptionEventName,
  isUnsubscribeEventName,
} from '../common/utils/reply.ts';
import { commandsToBuffer, getCommandName } from '../common/utils/request.ts';
import { RespPush } from '../types/resp.ts';
import { SolidisProtocols } from '../types/solidis.ts';
import { SolidisParser } from './parser.ts';

import type {
  SolidisCommandKind,
  SolidisData,
  SolidisDebugLogType,
  SolidisPipeline,
  SolidisRequest,
  SolidisRequesterOptions,
  SolidisSendOptions,
  SolidisSubRequest,
  StringOrBuffer,
} from '../types/solidis.ts';

interface SolidisPipelineDraft {
  commands: StringOrBuffer[][];
  subRequests: SolidisSubRequest[];
  timeout: number;
  isBlocking: boolean;
}

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

  return kind ?? undefined;
}

function isReplySuppression(command: StringOrBuffer[]) {
  const subcommand = String(command[1]).toUpperCase();
  const mode = String(command[2]).toUpperCase();

  return subcommand === 'REPLY' && (mode === 'OFF' || mode === 'SKIP');
}

function isUnsupported(command: StringOrBuffer[], kind: SolidisCommandKind) {
  return (
    kind === 'unsupported' || (kind === 'client' && isReplySuppression(command))
  );
}

function resolveTimeout(commandTimeout: number, blockingTimeout?: number) {
  if (commandTimeout <= 0 || blockingTimeout === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return commandTimeout + (blockingTimeout ?? 0);
}

function getReplySpan(
  command: StringOrBuffer[],
  kind: SolidisCommandKind | undefined,
) {
  if (kind === undefined || !isSubscriptionEventName(kind)) {
    return 1;
  }

  return Math.max(1, command.length - 1);
}

function createDraft(): SolidisPipelineDraft {
  return {
    commands: [],
    subRequests: [],
    timeout: 0,
    isBlocking: false,
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
  #writeQueue: SolidisPipeline[] = [];
  #inflightQueue: SolidisPipeline[] = [];
  #flushHandle: NodeJS.Immediate | undefined;
  #isWaitingForDrain = false;
  #protocol: SolidisProtocols = SolidisProtocols.RESP2;
  #database: number;

  constructor(options: SolidisRequesterOptions) {
    const { connection } = options;

    this.#options = options;
    this.#parser = new SolidisParser(options);
    this.#database = options.database;
    this.#debug = generateDebugHandle(options.debugMemory);

    connection.on('data', (chunk) => this.#receive(chunk));
    connection.on('drain', () => this.#resumeWriting());
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

  public send(
    commands: StringOrBuffer[][],
    options?: SolidisSendOptions,
  ): Promise<SolidisData[][]> {
    if (commands.length === 0) {
      return Promise.resolve([]);
    }

    let kinds: (SolidisCommandKind | undefined)[] | undefined;

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];

      if (command.length === 0) {
        return Promise.reject(
          new SolidisRequesterError('Cannot send an empty command.'),
        );
      }

      const kind = classifyCommand(command);

      if (kind === undefined) {
        continue;
      }

      if (isUnsupported(command, kind)) {
        return Promise.reject(
          new SolidisRequesterError(
            `${getCommandName(command)} is not supported: it breaks the pairing of requests and replies.`,
          ),
        );
      }

      kinds ??= [];
      kinds[index] = kind;
    }

    const blockingTimeout = options?.blockingTimeout;

    return new Promise((resolve, reject) => {
      this.#pendingRequests.push({
        commands,
        kinds,
        replies: [],
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
      const error = new SolidisRequesterError('Socket is not connected.');

      for (const request of requests) {
        request.reject(error);
      }

      return;
    }

    this.#enqueue(requests);
    this.#write();
  }

  #enqueue(requests: SolidisRequest[]) {
    const maxCommandsPerPipeline = Math.max(
      1,
      this.#options.maxCommandsPerPipeline,
    );

    let draft = createDraft();

    for (const request of requests) {
      const lastIndex = request.commands.length - 1;

      if (
        draft.commands.length > 0 &&
        (request.isBlocking ||
          draft.isBlocking ||
          request.timeout !== draft.timeout)
      ) {
        this.#seal(draft);

        draft = createDraft();
      }

      for (let index = 0; index <= lastIndex; index += 1) {
        if (draft.commands.length >= maxCommandsPerPipeline) {
          this.#seal(draft);

          draft = createDraft();
        }

        const kind = request.kinds?.[index];
        const command = this.#expandCommand(request.commands[index], kind);

        draft.commands.push(command);
        draft.subRequests.push({
          request,
          command,
          kind,
          span: getReplySpan(command, kind),
          isLast: index === lastIndex,
        });
        draft.timeout = request.timeout;
        draft.isBlocking ||= request.isBlocking;
      }
    }

    if (draft.commands.length > 0) {
      this.#seal(draft);
    }
  }

  #expandCommand(
    command: StringOrBuffer[],
    kind: SolidisCommandKind | undefined,
  ) {
    if (
      command.length > 1 ||
      kind === undefined ||
      !isUnsubscribeEventName(kind)
    ) {
      return command;
    }

    const subscriptions = this.#options.pubSub.getSubscriptions(kind);

    return subscriptions.size === 0 ? command : [command[0], ...subscriptions];
  }

  #seal(draft: SolidisPipelineDraft) {
    const pipeline: SolidisPipeline = {
      buffer: commandsToBuffer(draft.commands),
      subRequests: draft.subRequests,
      subRequestIndex: 0,
      subReplies: [],
      timer: undefined,
      isBlocking: draft.isBlocking,
      isTimedOut: false,
    };

    if (Number.isFinite(draft.timeout)) {
      pipeline.timer = setTimeout(
        () => this.#timeOut(pipeline, draft.timeout),
        draft.timeout,
      );
    }

    this.#debug?.(
      'debug',
      `Requester serialized: ${sanitizeCommandsBufferForDebug(pipeline.buffer, draft.commands)}`,
    );

    this.#writeQueue.push(pipeline);
  }

  #write() {
    const { connection } = this.#options;

    while (!this.#isWaitingForDrain) {
      const pipeline = this.#writeQueue.shift();

      if (pipeline === undefined) {
        return;
      }

      if (pipeline.isTimedOut) {
        continue;
      }

      this.#inflightQueue.push(pipeline);
      this.#isWaitingForDrain = !connection.write(pipeline.buffer);
    }
  }

  #resumeWriting() {
    this.#isWaitingForDrain = false;

    this.#write();
  }

  #receive(chunk: Buffer) {
    let replies: SolidisData[];

    this.#debug?.('debug', `Requester received ${chunk.length} bytes`);

    try {
      replies = this.#parser.parse(chunk);
    } catch (error) {
      const parserError = wrapWithParserError(error);

      this.#options.emit('error', parserError);
      this.#options.connection.reset(parserError);

      return;
    }

    for (const reply of replies) {
      this.#route(reply);
    }
  }

  #route(reply: SolidisData) {
    const isPush = reply instanceof RespPush;
    const confirmation = this.#getExpectedConfirmation();
    const isSubscribed =
      this.#protocol === SolidisProtocols.RESP2 &&
      this.#options.pubSub.hasActiveSubscriptions;

    if (!isPush && !isSubscribed && confirmation === undefined) {
      this.#resolveNext(reply);

      return;
    }

    const eventName = Array.isArray(reply)
      ? getPubSubEventName(reply)
      : undefined;

    if (!Array.isArray(reply) || eventName === undefined) {
      if (isPush) {
        this.#emitPush(reply);
      } else {
        this.#resolveNext(reply);
      }

      return;
    }

    if (eventName === confirmation) {
      this.#options.pubSub.dispatchSubscriptionChange(confirmation, reply);
      this.#resolveNext(reply);

      return;
    }

    if (!isPush && !isSubscribed) {
      this.#resolveNext(reply);

      return;
    }

    if (isMessageEventName(eventName)) {
      this.#options.pubSub.dispatchMessage(eventName, reply);
    } else if (isSubscriptionEventName(eventName)) {
      this.#options.pubSub.dispatchSubscriptionChange(eventName, reply);
    }
  }

  #getExpectedConfirmation() {
    const pipeline = this.#inflightQueue[0];

    if (pipeline === undefined) {
      return undefined;
    }

    const kind = pipeline.subRequests[pipeline.subRequestIndex].kind;

    return kind !== undefined && isSubscriptionEventName(kind)
      ? kind
      : undefined;
  }

  #emitPush(reply: RespPush) {
    try {
      this.#options.emit('push', reply);
    } catch (error) {
      this.#options.emit(
        'error',
        new SolidisRequesterError("A 'push' listener threw", error),
      );
    }
  }

  #resolveNext(reply: SolidisData) {
    const pipeline = this.#inflightQueue[0];

    if (pipeline === undefined) {
      this.#options.emit(
        'error',
        new SolidisRequesterError('Received reply with no pending request'),
      );

      return;
    }

    const subRequest = pipeline.subRequests[pipeline.subRequestIndex];

    pipeline.subReplies.push(reply);

    if (
      pipeline.subReplies.length < subRequest.span &&
      !(reply instanceof RespError)
    ) {
      return;
    }

    const replies = pipeline.subReplies;

    pipeline.subReplies = [];
    pipeline.subRequestIndex += 1;

    if (pipeline.subRequestIndex === pipeline.subRequests.length) {
      clearTimeout(pipeline.timer);

      this.#inflightQueue.shift();
    }

    this.#complete(subRequest, replies);
  }

  #complete(subRequest: SolidisSubRequest, replies: SolidisData[]) {
    const { request } = subRequest;

    if (subRequest.kind !== undefined) {
      this.#track(subRequest, replies[0]);
    }

    request.replies.push(replies);

    const error =
      this.#options.rejectOnPartialPipelineError && findErrorInReplies(replies);

    if (error) {
      request.reject(error);
    } else if (subRequest.isLast) {
      request.resolve(request.replies);
    }
  }

  #track(subRequest: SolidisSubRequest, reply: SolidisData) {
    const argument = subRequest.command[1];

    switch (subRequest.kind) {
      case 'select': {
        if (reply === 'OK') {
          this.#database = Number(String(argument));
        }

        return;
      }

      case 'hello': {
        if (argument !== undefined && !(reply instanceof RespError)) {
          this.#protocol =
            String(argument) === '3'
              ? SolidisProtocols.RESP3
              : SolidisProtocols.RESP2;
        }

        return;
      }

      case 'reset': {
        if (reply === 'RESET') {
          this.#protocol = SolidisProtocols.RESP2;
          this.#database = 0;

          this.#options.pubSub.clear();
        }

        return;
      }

      default: {
        return;
      }
    }
  }

  #timeOut(pipeline: SolidisPipeline, timeout: number) {
    const error = new SolidisRequesterError(
      `Command(s) timed out after ${timeout} ms.`,
    );

    pipeline.isTimedOut = true;

    for (const subRequest of pipeline.subRequests) {
      subRequest.request.reject(error);
    }

    if (
      pipeline.isBlocking ||
      this.#inflightQueue.every((inflight) => inflight.isTimedOut)
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
    const pipelines = [...this.#writeQueue, ...this.#inflightQueue];
    const requests = this.#pendingRequests;

    clearImmediate(this.#flushHandle);

    this.#flushHandle = undefined;
    this.#pendingRequests = [];
    this.#writeQueue = [];
    this.#inflightQueue = [];
    this.#isWaitingForDrain = false;
    this.#parser = new SolidisParser(this.#options);
    this.#protocol = SolidisProtocols.RESP2;

    for (const pipeline of pipelines) {
      clearTimeout(pipeline.timer);

      for (const subRequest of pipeline.subRequests) {
        subRequest.request.reject(error);
      }
    }

    for (const request of requests) {
      request.reject(error);
    }
  }
}
