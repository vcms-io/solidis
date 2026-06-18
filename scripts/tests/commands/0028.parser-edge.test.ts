/** Parser edge & adversarial branch coverage. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RespError,
  SolidisDefaultOptions,
  SolidisParser,
} from '../../../sources/index.ts';

import type { SolidisData } from '../../../sources/index.ts';

function bytes(input: string): Buffer {
  return Buffer.from(input, 'latin1');
}

function createParser(): SolidisParser {
  return new SolidisParser(SolidisDefaultOptions);
}

async function parseOnce(...chunks: Buffer[]): Promise<SolidisData[]> {
  return createParser().queueParse(...chunks);
}

describe('parser-edge', () => {
  describe('negative-length aggregates resolve to null', () => {
    it('parses a null map', async () => {
      assert.deepStrictEqual(await parseOnce(bytes('%-1\r\n')), [null]);
    });

    it('parses a null set', async () => {
      assert.deepStrictEqual(await parseOnce(bytes('~-1\r\n')), [null]);
    });

    it('parses a null push', async () => {
      assert.deepStrictEqual(await parseOnce(bytes('>-1\r\n')), [null]);
    });
  });

  describe('frames truncated at every boundary wait for more data', () => {
    const partials = [
      ['map header only', '%2'],
      ['map awaiting first key', '%1\r\n'],
      ['map awaiting value', '%1\r\n+k\r\n'],
      ['map with incomplete value', '%1\r\n+k\r\n:1'],
      ['set header only', '~2'],
      ['set awaiting element', '~2\r\n:1\r\n'],
      ['attribute awaiting body', '|1\r\n+k\r\n'],
      ['simple string without CRLF', '+OK'],
      ['integer without CRLF', ':123'],
      ['double without CRLF', ',1.5'],
      ['big number without CRLF', '(123'],
      ['bulk header without body', '$10\r\n'],
      ['null awaiting its CRLF', '_'],
      ['boolean awaiting its CRLF', '#t'],
      ['push header only', '>2'],
      ['verbatim header without body', '=4\r\ntx'],
    ] as const;

    for (const [label, frame] of partials) {
      it(`waits on a ${label}`, async () => {
        assert.deepStrictEqual(await parseOnce(bytes(frame)), []);
      });
    }
  });

  describe('maps with degenerate keys', () => {
    it('skips a null-keyed entry but still parses the map', async () => {
      const [reply] = await parseOnce(bytes('%1\r\n$-1\r\n+value\r\n'));

      assert.ok(reply instanceof Map);
      assert.strictEqual(reply.size, 0);
    });

    it('coerces an integer key to a string', async () => {
      const [reply] = await parseOnce(bytes('%1\r\n:7\r\n+seven\r\n'));

      assert.ok(reply instanceof Map);
      assert.strictEqual(reply.get('7'), 'seven');
    });

    it('preserves a zero integer as a map key', async () => {
      const [reply] = await parseOnce(bytes('%1\r\n:0\r\n+zero\r\n'));

      assert.ok(reply instanceof Map);
      assert.strictEqual(reply.get('0'), 'zero');
    });
  });

  describe('attributes', () => {
    it('ignores a null attribute and surfaces the next reply', async () => {
      assert.deepStrictEqual(await parseOnce(bytes('|-1\r\n+actual\r\n')), [
        'actual',
      ]);
    });

    it('ignores a populated attribute map and surfaces the next reply', async () => {
      assert.deepStrictEqual(
        await parseOnce(bytes('|1\r\n+ttl\r\n:60\r\n:42\r\n')),
        [42],
      );
    });
  });

  describe('malformed RESP3 scalars degrade to RespError', () => {
    it('turns an unparseable double into a RespError', async () => {
      const [reply] = await parseOnce(bytes(',not-a-number\r\n'));

      assert.ok(reply instanceof RespError);
      assert.match(reply.message, /Double parse error/i);
    });

    it('turns an unparseable big number into a RespError', async () => {
      const [reply] = await parseOnce(bytes('(12notdigits\r\n'));

      assert.ok(reply instanceof RespError);
      assert.match(reply.message, /BigNumber parse error/i);
    });

    it('parses a blob error into a RespError carrying its text', async () => {
      const [reply] = await parseOnce(
        bytes('!21\r\nSYNTAX invalid syntax\r\n'),
      );

      assert.ok(reply instanceof RespError);
      assert.strictEqual(reply.message, 'SYNTAX invalid syntax');
    });
  });

  describe('boundary scalars', () => {
    it('parses an empty simple string', async () => {
      assert.deepStrictEqual(await parseOnce(bytes('+\r\n')), ['']);
    });

    it('parses an empty verbatim string', async () => {
      const [reply] = await parseOnce(bytes('=4\r\ntxt:\r\n'));

      assert.strictEqual(reply, 'txt:');
    });

    it('parses a negative-length verbatim string as null', async () => {
      assert.deepStrictEqual(await parseOnce(bytes('=-1\r\n')), [null]);
    });

    it('parses a double of exactly zero', async () => {
      assert.deepStrictEqual(await parseOnce(bytes(',0\r\n')), [0]);
    });
  });

  describe('bulk string length enforcement', () => {
    it('rejects a bulk string whose declared length exceeds the configured maximum', async () => {
      const parser = new SolidisParser({
        ...SolidisDefaultOptions,
        parser: {
          buffer: {
            initial: 256,
            shiftThreshold: 128,
          },
          maxBulkStringLength: 1024,
        },
      });

      const oversized = Buffer.from('$2048\r\n');

      await assert.rejects(parser.queueParse(oversized), (error: Error) =>
        error.message.includes('length'),
      );
    });
  });

  describe('streaming the nastiest frames one byte at a time', () => {
    it('reassembles a map split across single-byte chunks', async () => {
      const parser = createParser();
      const frame = bytes('%2\r\n+a\r\n:1\r\n+b\r\n:2\r\n');

      let collected: SolidisData[] = [];

      for (let index = 0; index < frame.length; index += 1) {
        collected = await parser.queueParse(frame.subarray(index, index + 1));
      }

      assert.strictEqual(collected.length, 1);
      assert.ok(collected[0] instanceof Map);

      if (collected[0] instanceof Map) {
        assert.strictEqual(collected[0].get('a'), 1);
        assert.strictEqual(collected[0].get('b'), 2);
      }
    });
  });
});
