import { stdout } from 'node:process';
import { Transform, Writable, pipeline } from 'node:stream';

import { SolidisStringSymbols } from '../common/constants.ts';

import type {
  SolidisDebugLog,
  SolidisDebugMemoryEventHandlers,
} from '../index.ts';

export class SolidisDebugTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(
    entry: SolidisDebugLog,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: string) => void,
  ) {
    const formattedMessage = `[Solidis ${entry.type}] ${entry.message}${
      entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    }${SolidisStringSymbols.NL}`;

    callback(null, formattedMessage);
  }
}

export class SolidisDebugMemory extends Writable {
  #logs: SolidisDebugLog[] = [];
  #debugTransform?: SolidisDebugTransform;

  readonly #maxEntries: number;

  public declare emit: SolidisDebugMemoryEventHandlers<this>['emit'];
  public declare on: SolidisDebugMemoryEventHandlers<this>['on'];
  public declare write: SolidisDebugMemoryEventHandlers<this>['write'];

  constructor(maxEntries: number) {
    super({ objectMode: true });
    this.#maxEntries = maxEntries;

    if (
      process.env.DEBUG?.toLowerCase().includes('solidis') ||
      process.env.DEBUG === '*'
    ) {
      this.#setupDebugStream();
    }
  }

  #setupDebugStream() {
    this.#debugTransform = new SolidisDebugTransform();

    pipeline(this.#debugTransform, stdout, (error) => {
      if (error) {
        this.#logs.push({
          timestamp: Date.now(),
          type: 'error',
          message: error.message,
          data: error,
        });
      }
    });
  }

  public _write(
    entry: SolidisDebugLog,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    if (!entry.timestamp) {
      entry.timestamp = Date.now();
    }

    this.#logs.push(entry);

    if (this.#logs.length > this.#maxEntries) {
      this.#logs.shift();
    }

    if (this.#debugTransform) {
      this.#debugTransform.write(entry);
    }

    this.emit('pushed', entry);

    callback();
  }

  public getLogs(): readonly SolidisDebugLog[] {
    return Object.freeze([...this.#logs]);
  }

  public clearLogs() {
    this.#logs = [];
  }
}
