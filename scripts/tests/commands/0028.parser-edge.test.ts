/** Parser edge & adversarial branch coverage. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RespError,
  SolidisDefaultOptions,
  SolidisParser,
  SolidisParserError,
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

      assert.deepStrictEqual(reply, new Map());
    });

    it('coerces an integer key to a string', async () => {
      const [reply] = await parseOnce(bytes('%1\r\n:7\r\n+seven\r\n'));

      assert.deepStrictEqual(reply, new Map([['7', 'seven']]));
    });

    it('preserves a zero integer as a map key', async () => {
      const [reply] = await parseOnce(bytes('%1\r\n:0\r\n+zero\r\n'));

      assert.deepStrictEqual(reply, new Map([['0', 'zero']]));
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

  describe('integer digit validation', () => {
    it('rejects a malformed integer with letter characters', async () => {
      const result = await parseOnce(bytes(':12ab\r\n'));

      assert.strictEqual(result.length, 1, 'must parse exactly one value');
      if (!(result[0] instanceof RespError)) {
        assert.fail('expected a RespError for malformed integer');
      }
      assert.strictEqual(result[0].message, "Integer parse error: '12ab'");
    });

    it('rejects a malformed integer containing a space character', async () => {
      const result = await parseOnce(bytes(':1 2\r\n'));

      assert.strictEqual(result.length, 1, 'must parse exactly one value');
      if (!(result[0] instanceof RespError)) {
        assert.fail('expected a RespError for malformed integer');
      }
      assert.strictEqual(result[0].message, "Integer parse error: '1 2'");
    });

    it('rejects a float-in-integer frame instead of producing garbage', async () => {
      const result = await parseOnce(bytes(':3.14\r\n'));

      assert.strictEqual(result.length, 1, 'must parse exactly one value');
      if (!(result[0] instanceof RespError)) {
        assert.fail('expected a RespError for malformed integer');
      }
      assert.strictEqual(result[0].message, "Integer parse error: '3.14'");
    });

    it('rejects an array length containing non-digit characters', async () => {
      const frame = bytes('*2x\r\n+a\r\n+b\r\n');

      await assert.rejects(
        () => parseOnce(frame),
        (error: Error) =>
          error instanceof SolidisParserError &&
          error.message === 'Array parse error: non-digit byte 0x78',
        'a malformed array length "*2x\\r\\n" must throw a ' +
          'SolidisParserError because the corrupted length would stall ' +
          'all subsequent replies on the connection',
      );
    });
  });

  describe('malformed RESP3 scalars degrade to RespError', () => {
    it('turns an unparseable double into a RespError', async () => {
      const [reply] = await parseOnce(bytes(',not-a-number\r\n'));

      if (!(reply instanceof RespError)) {
        assert.fail('expected a RespError for unparseable double');
      }
      assert.strictEqual(reply.message, "Double parse error: 'not-a-number'");
    });

    it('turns an unparseable big number into a RespError', async () => {
      const [reply] = await parseOnce(bytes('(12notdigits\r\n'));

      if (!(reply instanceof RespError)) {
        assert.fail('expected a RespError for unparseable big number');
      }
      assert.strictEqual(reply.message, "BigNumber parse error: '12notdigits'");
    });

    it('parses a blob error into a RespError carrying its text', async () => {
      const [reply] = await parseOnce(
        bytes('!21\r\nSYNTAX invalid syntax\r\n'),
      );

      if (!(reply instanceof RespError)) {
        assert.fail('expected a RespError for blob error frame');
      }

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

      await assert.rejects(
        parser.queueParse(oversized),
        (error: Error) =>
          error instanceof SolidisParserError &&
          error.message === 'Bulk length 2048 exceeds maximum allowed 1024',
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
      assert.deepStrictEqual(
        collected[0],
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      );
    });
  });

  describe('internal buffer management', () => {
    it('grows the internal buffer when a second chunk exceeds remaining capacity', async () => {
      const parser = new SolidisParser({
        ...SolidisDefaultOptions,
        parser: {
          buffer: { initial: 32, shiftThreshold: 16 },
          maxBulkStringLength: 1048576,
        },
      });

      const payload = 'x'.repeat(256);
      const header = bytes(`$${payload.length}\r\n`);
      const bodyPart1 = bytes(payload.slice(0, 200));
      const bodyPart2 = bytes(`${payload.slice(200)}\r\n`);

      assert.deepStrictEqual(
        await parser.queueParse(header),
        [],
        'an incomplete bulk header must wait for body bytes',
      );
      assert.deepStrictEqual(
        await parser.queueParse(bodyPart1),
        [],
        'a partial bulk body must wait for the remainder',
      );

      const result = await parser.queueParse(bodyPart2);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], Buffer.from(payload, 'latin1'));
    });

    it('shifts the internal buffer when readOffset exceeds the threshold', async () => {
      const parser = new SolidisParser({
        ...SolidisDefaultOptions,
        parser: {
          buffer: { initial: 512, shiftThreshold: 16 },
          maxBulkStringLength: 1048576,
        },
      });

      assert.deepStrictEqual(
        await parser.queueParse(bytes('+O')),
        [],
        'a truncated simple string must keep bytes on the internal buffer',
      );

      const result = await parser.queueParse(
        bytes(`K\r\n${'+OK\r\n'.repeat(19)}`),
      );

      assert.deepStrictEqual(
        result,
        Array.from({ length: 20 }, () => 'OK'),
      );
    });

    it('handles consecutive large payloads that force repeated buffer growth', async () => {
      const parser = new SolidisParser({
        ...SolidisDefaultOptions,
        parser: {
          buffer: { initial: 16, shiftThreshold: 8 },
          maxBulkStringLength: 1048576,
        },
      });

      for (let round = 0; round < 3; round += 1) {
        const payload = 'y'.repeat(128 * (round + 1));
        const frame = bytes(`$${payload.length}\r\n${payload}\r\n`);

        const result = await parser.queueParse(frame);

        assert.strictEqual(result.length, 1);
        assert.deepStrictEqual(result[0], Buffer.from(payload, 'latin1'));
      }
    });
  });

  describe('malformed RESP3 null and integer edge cases', () => {
    it('waits for more data when a malformed integer frame lacks CRLF', async () => {
      const result = await parseOnce(bytes(':12ab'));

      assert.deepStrictEqual(
        result,
        [],
        '#parseNumeric throws on the non-digit "a" byte, and the ' +
          'catch path in #parseInteger calls #parseLine which returns null ' +
          'because no CRLF terminator exists — so the parser correctly ' +
          'yields nothing and waits for more data',
      );
    });

    it('reassembles a RESP3 null reply delivered across two chunks', async () => {
      const parser = createParser();

      assert.deepStrictEqual(
        await parser.queueParse(bytes('_\r')),
        [],
        'a null marker without its LF byte must wait for the next chunk',
      );

      assert.deepStrictEqual(await parser.queueParse(bytes('\n')), [null]);
    });

    it('throws a parser error for a RESP3 null with corrupted CRLF', async () => {
      await assert.rejects(
        () => parseOnce(bytes('_X\r\n')),
        (error: Error) =>
          error instanceof SolidisParserError &&
          error.message === 'Null parse error: missing CRLF',
        '#checkCRLF detects that offset+1 after the underscore prefix ' +
          'is 0x58 ("X") instead of CR, and throws a SolidisParserError',
      );
    });
  });

  describe('integer BigInt auto-promotion', () => {
    it('promotes a 16-digit integer exceeding MAX_SAFE_INTEGER to BigInt', async () => {
      const [reply] = await parseOnce(bytes(':9007199254740993\r\n'));

      assert.strictEqual(reply, 9007199254740993n);
    });

    it('keeps a 15-digit integer within safe range as a number', async () => {
      const [reply] = await parseOnce(bytes(':999999999999999\r\n'));

      assert.strictEqual(reply, 999999999999999);
    });

    it('promotes a negative integer beyond safe range to BigInt', async () => {
      const [reply] = await parseOnce(bytes(':-9007199254740993\r\n'));

      assert.strictEqual(reply, -9007199254740993n);
    });

    it('keeps Number.MAX_SAFE_INTEGER as a number', async () => {
      const [reply] = await parseOnce(bytes(':9007199254740991\r\n'));

      assert.strictEqual(reply, Number.MAX_SAFE_INTEGER);
    });

    it('promotes a 20-digit integer to BigInt', async () => {
      const [reply] = await parseOnce(bytes(':92233720368547758070\r\n'));

      assert.strictEqual(reply, 92233720368547758070n);
    });

    it('handles BigInt integer split across chunks', async () => {
      const parser = createParser();

      assert.deepStrictEqual(
        await parser.queueParse(bytes(':900719925474')),
        [],
      );

      const [reply] = await parser.queueParse(bytes('0993\r\n'));

      assert.strictEqual(reply, 9007199254740993n);
    });
  });
});
