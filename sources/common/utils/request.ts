import { SolidisBufferSymbols } from '../index.ts';

import type { StringOrBuffer } from '../../index.ts';

const { NL, ASTERISK, DOLLAR, L0 } = SolidisBufferSymbols;

class BufferPool {
  #buffers: (string | Buffer)[] = [];
  #length = 0;

  public push(...items: (string | Buffer)[]) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      if (item instanceof Buffer) {
        this.#length += item.length;

        continue;
      }

      this.#length += Buffer.byteLength(item);
    }

    this.#buffers.push(...items);
  }

  public toBuffer(): Buffer {
    const result = Buffer.allocUnsafe(this.#length);
    let offset = 0;

    for (let index = 0; index < this.#buffers.length; index += 1) {
      const item = this.#buffers[index];

      if (Buffer.isBuffer(item)) {
        item.copy(result, offset);
        offset += item.length;

        continue;
      }

      result.write(item, offset);
      offset += Buffer.byteLength(item);
    }

    this.#buffers = [];
    this.#length = 0;

    return result;
  }
}

const sharedBufferPool = new BufferPool();

export function commandsToBuffer(commands: StringOrBuffer[][]): Buffer {
  for (const commandArguments of commands) {
    sharedBufferPool.push(ASTERISK, `${commandArguments.length}`, NL);

    for (const argument of commandArguments) {
      if (argument instanceof Buffer) {
        if (argument.length === 0) {
          sharedBufferPool.push(L0);

          continue;
        }

        sharedBufferPool.push(DOLLAR, `${argument.length}`, NL, argument, NL);

        continue;
      }

      if (argument.length === 0) {
        sharedBufferPool.push(L0);

        continue;
      }

      sharedBufferPool.push(
        DOLLAR,
        `${Buffer.byteLength(argument)}`,
        NL,
        argument,
        NL,
      );
    }
  }

  return sharedBufferPool.toBuffer();
}

export function extractNextChunkToWrite(
  buffer: Buffer,
  offset: number,
  maxSize: number,
): Buffer {
  const endOffset = Math.min(offset + maxSize, buffer.length);

  return buffer.subarray(offset, endOffset);
}
