import { EventEmitter } from 'node:events';
import { stdout } from 'node:process';
import { inspect } from 'node:util';

import type {
  SolidisDebugLog,
  SolidisDebugMemoryEventHandlers,
} from '../types/solidis.ts';

export function formatDebugLog(entry: SolidisDebugLog): string {
  const data =
    entry.data === undefined
      ? ''
      : ` ${inspect(entry.data, { breakLength: Number.POSITIVE_INFINITY })}`;

  return `[Solidis ${entry.type}] ${entry.message}${data}\n`;
}

export class SolidisDebugMemory extends EventEmitter {
  readonly #entries: (SolidisDebugLog | undefined)[];
  readonly #isPrinting: boolean;

  #nextIndex = 0;
  #size = 0;

  declare public emit: SolidisDebugMemoryEventHandlers<this>['emit'];
  declare public on: SolidisDebugMemoryEventHandlers<this>['on'];

  constructor(maxEntries: number) {
    super();

    const debugPattern = process.env.DEBUG?.toLowerCase() ?? '';

    this.#entries = new Array(Math.max(0, maxEntries));
    this.#isPrinting = debugPattern === '*' || debugPattern.includes('solidis');
  }

  public write(entry: SolidisDebugLog) {
    const capacity = this.#entries.length;

    entry.timestamp ??= Date.now();

    if (capacity > 0) {
      this.#entries[this.#nextIndex] = entry;
      this.#nextIndex = (this.#nextIndex + 1) % capacity;
      this.#size = Math.min(this.#size + 1, capacity);
    }

    if (this.#isPrinting) {
      stdout.write(formatDebugLog(entry));
    }

    this.emit('pushed', entry);
  }

  public getLogs(): readonly SolidisDebugLog[] {
    const capacity = this.#entries.length;
    const firstIndex = this.#nextIndex - this.#size + capacity;
    const logs: SolidisDebugLog[] = [];

    for (let offset = 0; offset < this.#size; offset += 1) {
      const entry = this.#entries[(firstIndex + offset) % capacity];

      if (entry !== undefined) {
        logs.push(entry);
      }
    }

    return Object.freeze(logs);
  }

  public clearLogs() {
    this.#entries.fill(undefined);
    this.#nextIndex = 0;
    this.#size = 0;
  }
}
