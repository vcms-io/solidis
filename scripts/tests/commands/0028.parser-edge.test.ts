/** Parser edge & adversarial branch coverage. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RespError,
  RespPush,
  SolidisDefaultOptions,
  SolidisParser,
  SolidisParserError,
} from '../../../sources/index.ts';
import { assertGrowth, measureTime } from '../utils/index.ts';

import type { SolidisData } from '../../../sources/index.ts';

function bytes(input: string): Buffer {
  return Buffer.from(input, 'latin1');
}

function createParser(): SolidisParser {
  return new SolidisParser(SolidisDefaultOptions);
}

function parseOnce(...chunks: Buffer[]): SolidisData[] {
  const parser = createParser();

  return chunks.flatMap((chunk) => parser.parse(chunk));
}

function isParserError(message: string) {
  return (error: Error) =>
    error instanceof SolidisParserError && error.message === message;
}

describe('parser-edge', () => {
  describe('negative lengths', () => {
    it('parses the RESP2 null array and null bulk string', () => {
      assert.deepStrictEqual(parseOnce(bytes('*-1\r\n$-1\r\n')), [null, null]);
    });

    it('refuses a negative length for every other type', () => {
      for (const prefix of ['%', '~', '>', '|', '!', '=']) {
        assert.throws(
          () => parseOnce(bytes(`${prefix}-1\r\n`)),
          isParserError("Invalid length '-1'"),
          prefix,
        );
      }
    });

    it('never lets a negative push length take the next reply', () => {
      const parser = createParser();

      assert.throws(
        () => parser.parse(bytes('>-1\r\n+OK\r\n')),
        isParserError("Invalid length '-1'"),
      );
    });

    it('refuses a negative length other than -1 for arrays and bulk strings', () => {
      for (const length of ['-2', '-5', '-10']) {
        for (const prefix of ['*', '$']) {
          assert.throws(
            () => parseOnce(bytes(`${prefix}${length}\r\n`)),
            isParserError(`Invalid length '${length}'`),
            `${prefix}${length}`,
          );
        }
      }
    });

    it('refuses replies nested deeper than 512 levels', () => {
      const [deepest] = parseOnce(bytes(`${'*1\r\n'.repeat(512)}:1\r\n`));

      let level: unknown = deepest;

      for (let depth = 0; depth < 512; depth += 1) {
        assert.ok(Array.isArray(level));
        [level] = level;
      }

      assert.strictEqual(level, 1);
      assert.throws(
        () => parseOnce(bytes(`${'*1\r\n'.repeat(513)}:1\r\n`)),
        isParserError('Nesting exceeds maximum depth 512'),
      );
    });

    it('parses an empty map and an empty set', () => {
      assert.deepStrictEqual(parseOnce(bytes('%0\r\n~0\r\n')), [
        new Map(),
        new Set(),
      ]);
    });
  });

  describe('frames truncated at every boundary wait for more data', () => {
    const partials: [string, string, string, SolidisData][] = [
      [
        'map header only',
        '%2',
        '\r\n+a\r\n:1\r\n+b\r\n:2\r\n',
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ],
      ['map awaiting first key', '%1\r\n', '+k\r\n:1\r\n', new Map([['k', 1]])],
      ['map awaiting value', '%1\r\n+k\r\n', ':1\r\n', new Map([['k', 1]])],
      [
        'map with incomplete value',
        '%1\r\n+k\r\n:1',
        '\r\n',
        new Map([['k', 1]]),
      ],
      ['set header only', '~2', '\r\n:1\r\n:2\r\n', new Set([1, 2])],
      ['set awaiting element', '~2\r\n:1\r\n', ':2\r\n', new Set([1, 2])],
      ['attribute awaiting body', '|1\r\n+k\r\n', ':1\r\n+reply\r\n', 'reply'],
      ['simple string without CRLF', '+OK', '\r\n', 'OK'],
      ['integer without CRLF', ':123', '\r\n', 123],
      ['double without CRLF', ',1.5', '\r\n', 1.5],
      ['big number without CRLF', '(123', '\r\n', 123n],
      [
        'bulk header without body',
        '$10\r\n',
        '0123456789\r\n',
        bytes('0123456789'),
      ],
      ['null awaiting its CRLF', '_', '\r\n', null],
      ['boolean awaiting its CRLF', '#t', '\r\n', true],
      ['push header only', '>2', '\r\n+a\r\n+b\r\n', RespPush.from(['a', 'b'])],
      ['verbatim header without body', '=4\r\ntx', 't:\r\n', ''],
      ['bulk body without its trailing CRLF', '$2\r\nab', '\r\n', bytes('ab')],
      ['bulk body with only CR', '$2\r\nab\r', '\n', bytes('ab')],
    ];

    for (const [label, partial, remainder, expected] of partials) {
      it(`waits on a ${label} and completes once the rest arrives`, () => {
        const parser = createParser();

        assert.deepStrictEqual(parser.parse(bytes(partial)), []);
        assert.deepStrictEqual(parser.parse(bytes(remainder)), [expected]);
      });
    }

    it('rejects stray bytes where a reply prefix is expected', () => {
      assert.throws(
        () => parseOnce(bytes('+OK\r\n\r\n')),
        isParserError("Unknown prefix '\r'"),
      );
    });
  });

  describe('maps with degenerate keys', () => {
    it('skips a null-keyed entry but still parses the map', () => {
      const [reply] = parseOnce(bytes('%1\r\n$-1\r\n+value\r\n'));

      assert.deepStrictEqual(reply, new Map());
    });

    it('coerces an integer key to a string', () => {
      const [reply] = parseOnce(bytes('%1\r\n:7\r\n+seven\r\n'));

      assert.deepStrictEqual(reply, new Map([['7', 'seven']]));
    });

    it('preserves a zero integer as a map key', () => {
      const [reply] = parseOnce(bytes('%1\r\n:0\r\n+zero\r\n'));

      assert.deepStrictEqual(reply, new Map([['0', 'zero']]));
    });

    it('decodes a bulk-string key as UTF-8', () => {
      const [reply] = parseOnce(
        bytes('%1\r\n$6\r\n\xed\x95\x9c\xea\xb8\x80\r\n:1\r\n'),
      );

      assert.deepStrictEqual(reply, new Map([['한글', 1]]));
    });
  });

  describe('attributes', () => {
    it('ignores an empty attribute and surfaces the next reply', () => {
      assert.deepStrictEqual(parseOnce(bytes('|0\r\n+actual\r\n')), ['actual']);
    });

    it('ignores a populated attribute map and surfaces the next reply', () => {
      assert.deepStrictEqual(
        parseOnce(bytes('|1\r\n+ttl\r\n:60\r\n:42\r\n')),
        [42],
      );
    });

    it('ignores an attribute placed before an element inside a map', () => {
      assert.deepStrictEqual(
        parseOnce(bytes('%1\r\n+key\r\n|1\r\n+meta\r\n:1\r\n+value\r\n')),
        [new Map([['key', 'value']])],
      );
    });

    it('ignores an attribute nested inside an attribute', () => {
      assert.deepStrictEqual(
        parseOnce(bytes('|1\r\n+a\r\n|1\r\n+b\r\n+c\r\n+d\r\n+reply\r\n')),
        ['reply'],
      );
    });
  });

  describe('integer digit validation', () => {
    it('rejects a malformed integer with letter characters', () => {
      const result = parseOnce(bytes(':12ab\r\n'));

      assert.strictEqual(result.length, 1, 'must parse exactly one value');

      if (!(result[0] instanceof RespError)) {
        assert.fail('expected a RespError for malformed integer');
      }

      assert.strictEqual(result[0].message, "Integer: '12ab'");
    });

    it('rejects a malformed integer containing a space character', () => {
      const result = parseOnce(bytes(':1 2\r\n'));

      assert.strictEqual(result.length, 1, 'must parse exactly one value');

      if (!(result[0] instanceof RespError)) {
        assert.fail('expected a RespError for malformed integer');
      }

      assert.strictEqual(result[0].message, "Integer: '1 2'");
    });

    it('rejects a float-in-integer frame instead of producing garbage', () => {
      const result = parseOnce(bytes(':3.14\r\n'));

      assert.strictEqual(result.length, 1, 'must parse exactly one value');

      if (!(result[0] instanceof RespError)) {
        assert.fail('expected a RespError for malformed integer');
      }

      assert.strictEqual(result[0].message, "Integer: '3.14'");
    });

    it('rejects an integer without digits', () => {
      const [empty, sign] = parseOnce(bytes(':\r\n:-\r\n'));

      assert.ok(empty instanceof RespError);
      assert.strictEqual(empty.message, "Integer: ''");
      assert.ok(sign instanceof RespError);
      assert.strictEqual(sign.message, "Integer: '-'");
    });

    it('keeps the stream aligned after a malformed integer', () => {
      const result = parseOnce(bytes(':1x\r\n+next\r\n'));

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[1], 'next');
    });

    it('rejects an array length containing non-digit characters', () => {
      assert.throws(
        () => parseOnce(bytes('*2x\r\n+a\r\n+b\r\n')),
        isParserError("Invalid length '2x'"),
        'a malformed array length "*2x\\r\\n" must throw a ' +
          'SolidisParserError because the corrupted length would stall ' +
          'all subsequent replies on the connection',
      );
    });

    it('rejects a bulk length containing non-digit characters', () => {
      assert.throws(
        () => parseOnce(bytes('$1a\r\nx\r\n')),
        isParserError("Invalid length '1a'"),
      );
    });

    it('rejects an aggregate length too large to be a number', () => {
      assert.throws(
        () => parseOnce(bytes('*99999999999999999999\r\n')),
        isParserError("Invalid length '99999999999999999999'"),
      );
    });
  });

  describe('malformed RESP3 scalars degrade to RespError', () => {
    it('turns an unparseable double into a RespError', () => {
      const [reply] = parseOnce(bytes(',not-a-number\r\n'));

      if (!(reply instanceof RespError)) {
        assert.fail('expected a RespError for unparseable double');
      }

      assert.strictEqual(reply.message, "Double: 'not-a-number'");
    });

    it('turns an empty double into a RespError', () => {
      const [reply] = parseOnce(bytes(',\r\n'));

      assert.ok(reply instanceof RespError);
      assert.strictEqual(reply.message, "Double: ''");
    });

    it('turns an unparseable big number into a RespError', () => {
      const [reply] = parseOnce(bytes('(12notdigits\r\n'));

      if (!(reply instanceof RespError)) {
        assert.fail('expected a RespError for unparseable big number');
      }

      assert.strictEqual(reply.message, "BigNumber: '12notdigits'");
    });

    it('turns an empty big number into a RespError', () => {
      const [reply] = parseOnce(bytes('(\r\n'));

      assert.ok(reply instanceof RespError);
      assert.strictEqual(reply.message, "BigNumber: ''");
    });

    it('parses a negative big number', () => {
      assert.deepStrictEqual(parseOnce(bytes('(-123456789012345678901\r\n')), [
        -123456789012345678901n,
      ]);
    });

    it('parses a blob error into a RespError carrying its text', () => {
      const [reply] = parseOnce(bytes('!21\r\nSYNTAX invalid syntax\r\n'));

      if (!(reply instanceof RespError)) {
        assert.fail('expected a RespError for blob error frame');
      }

      assert.strictEqual(reply.message, 'SYNTAX invalid syntax');
      assert.strictEqual(reply.code, 'SYNTAX');
    });
  });

  describe('boundary scalars', () => {
    it('parses an empty simple string', () => {
      assert.deepStrictEqual(parseOnce(bytes('+\r\n')), ['']);
    });

    it('parses an empty verbatim string', () => {
      assert.deepStrictEqual(parseOnce(bytes('=4\r\ntxt:\r\n')), ['']);
    });

    it('keeps a verbatim string that has no format prefix', () => {
      assert.deepStrictEqual(parseOnce(bytes('=3\r\nabc\r\n')), ['abc']);
      assert.deepStrictEqual(parseOnce(bytes('=5\r\nab:cd\r\n')), ['ab:cd']);
    });

    it('parses the -nan spelling that Redis 6.2 sends as NaN', () => {
      const [value] = parseOnce(bytes(',-nan\r\n'));

      assert.ok(typeof value === 'number' && Number.isNaN(value));
    });

    it('parses integers and big numbers with a plus sign', () => {
      assert.deepStrictEqual(parseOnce(bytes(':+5\r\n(+12\r\n:+\r\n')), [
        5,
        12n,
        new RespError("Integer: '+'"),
      ]);
    });

    it('refuses doubles spelled the JavaScript way', () => {
      for (const text of ['0x10', ' 7', '7 ', '0b11', '0o7', '\t1', '1\xa0']) {
        const [value] = parseOnce(bytes(`,${text}\r\n`));

        assert.ok(value instanceof RespError, JSON.stringify(text));
        assert.strictEqual(value.message, `Double: '${text}'`);
      }

      assert.deepStrictEqual(
        parseOnce(bytes(',+1.5e3\r\n,1E300\r\n')),
        [1500, 1e300],
      );
    });

    it('refuses big numbers spelled the JavaScript way', () => {
      for (const text of [
        '0x10',
        ' 5',
        '5 ',
        '0b11',
        '0o7',
        '\t1',
        '1\xa0',
        '1_0',
        '+-1',
      ]) {
        const [value] = parseOnce(bytes(`(${text}\r\n`));

        assert.ok(value instanceof RespError, JSON.stringify(text));
        assert.strictEqual(value.message, `BigNumber: '${text}'`);
      }
    });

    it('joins a line end split by an empty chunk', () => {
      assert.deepStrictEqual(
        parseOnce(bytes('+OK\r'), bytes(''), bytes('\n')),
        ['OK'],
      );
      assert.deepStrictEqual(parseOnce(bytes(''), bytes('+OK\r\n')), ['OK']);
    });

    it('parses a double of exactly zero', () => {
      assert.deepStrictEqual(parseOnce(bytes(',0\r\n')), [0]);
    });

    it('parses doubles in exponent notation', () => {
      assert.deepStrictEqual(
        parseOnce(bytes(',1.5e3\r\n,-2E-2\r\n')),
        [1500, -0.02],
      );
    });
  });

  describe('bulk string length enforcement', () => {
    it('rejects a bulk string whose declared length exceeds the configured maximum', () => {
      const parser = new SolidisParser({
        parser: { maxBulkStringLength: 1024 },
      });

      assert.throws(
        () => parser.parse(Buffer.from('$2048\r\n')),
        isParserError('Bulk length 2048 exceeds maximum allowed 1024'),
      );
    });

    it('rejects a line that grows past the configured maximum before it ends', () => {
      const parser = new SolidisParser({
        parser: { maxBulkStringLength: 1024 },
      });

      assert.deepStrictEqual(parser.parse(bytes(`+${'a'.repeat(1000)}`)), []);
      assert.deepStrictEqual(parser.parse(bytes('a'.repeat(20))), []);
      assert.throws(
        () => parser.parse(bytes('a'.repeat(8))),
        isParserError('Line length exceeds maximum allowed 1024'),
      );
    });

    it('rejects a bulk string one byte past the configured maximum', () => {
      const parser = new SolidisParser({
        parser: { maxBulkStringLength: 4 },
      });

      assert.throws(
        () => parser.parse(bytes('$5\r\n')),
        isParserError('Bulk length 5 exceeds maximum allowed 4'),
      );
    });

    it('accepts an unfinished first chunk exactly at the maximum line length', () => {
      const parser = new SolidisParser({
        parser: { maxBulkStringLength: 10 },
      });

      assert.deepStrictEqual(parser.parse(bytes(`+${'a'.repeat(10)}`)), []);
      assert.deepStrictEqual(parser.parse(bytes('\r\n')), ['aaaaaaaaaa']);
      assert.throws(
        () =>
          new SolidisParser({ parser: { maxBulkStringLength: 10 } }).parse(
            bytes(`+${'a'.repeat(11)}`),
          ),
        isParserError('Line length exceeds maximum allowed 10'),
      );
    });

    it('rejects an unfinished line in the chunk that takes it past the maximum', () => {
      for (const [tail, isAllowed] of [
        ['aaaaa', true],
        ['aaaaa\r', true],
        ['aaaaaa', false],
        ['aaaaaa\r', false],
      ] as const) {
        const parser = new SolidisParser({
          parser: { maxBulkStringLength: 10 },
        });

        assert.deepStrictEqual(parser.parse(bytes('+aaaaa')), []);

        if (isAllowed) {
          assert.deepStrictEqual(parser.parse(bytes(tail)), []);
          assert.deepStrictEqual(
            parser.parse(bytes(tail.endsWith('\r') ? '\n' : '\r\n')),
            ['aaaaaaaaaa'],
          );
        } else {
          assert.throws(
            () => parser.parse(bytes(tail)),
            isParserError('Line length exceeds maximum allowed 10'),
            JSON.stringify(tail),
          );
        }
      }
    });

    it('parses a line split across thousands of chunks in linear time', async () => {
      await assertGrowth(
        (size) => {
          const parser = createParser();
          const stream = Buffer.concat([
            bytes('+'),
            Buffer.alloc(size, 0x61),
            bytes('\r\n-ERR '),
            Buffer.alloc(size, 0x62),
            bytes('\r'),
            bytes('\n:1\r\n'),
          ]);
          const replies: SolidisData[] = [];

          return measureTime(() => {
            for (let offset = 0; offset < stream.length; offset += 16384) {
              replies.push(
                ...parser.parse(stream.subarray(offset, offset + 16384)),
              );
            }

            const [line, error, integer] = replies;

            assert.strictEqual(replies.length, 3);
            assert.strictEqual(typeof line === 'string' && line.length, size);
            assert.ok(error instanceof RespError);
            assert.strictEqual(error.message.length, size + 4);
            assert.strictEqual(integer, 1);
          });
        },
        [1024 * 1024, 8 * 1024 * 1024],
        16,
      );
    });

    it('parses a bulk string full of carriage returns split across thousands of chunks in linear time', async () => {
      await assertGrowth(
        (size) => {
          const parser = createParser();
          const payload = Buffer.alloc(size, 0x0d);
          const stream = Buffer.concat([
            bytes(`$${size}\r\n`),
            payload,
            bytes('\r\n'),
          ]);
          const replies: SolidisData[] = [];

          return measureTime(() => {
            for (let offset = 0; offset < stream.length; offset += 4096) {
              replies.push(
                ...parser.parse(stream.subarray(offset, offset + 4096)),
              );
            }

            const [bulk] = replies;

            assert.strictEqual(replies.length, 1);
            assert.ok(Buffer.isBuffer(bulk) && bulk.equals(payload));
          });
        },
        [2 * 1024 * 1024, 16 * 1024 * 1024],
        16,
      );
    });

    it('parses a line that grows by one byte per chunk in linear time', async () => {
      await assertGrowth(
        (count) => {
          const parser = createParser();
          const head = Buffer.concat([
            bytes('+'),
            Buffer.alloc(count * 13, 0x61),
          ]);
          const byte = bytes('a');
          const replies: SolidisData[] = [];

          return measureTime(() => {
            replies.push(...parser.parse(head));

            for (let index = 0; index < count; index += 1) {
              replies.push(...parser.parse(byte));
            }

            replies.push(...parser.parse(bytes('\r\n')));

            const [line] = replies;

            assert.strictEqual(replies.length, 1);
            assert.strictEqual(
              typeof line === 'string' && line.length,
              count * 14,
            );
          });
        },
        [2_500, 20_000],
        16,
      );
    });

    it('merges the small chunks of an incomplete reply', (context) => {
      const parser = createParser();
      const size = 20000;
      const stream = bytes(`$${size}\r\n${'x'.repeat(size)}\r\n`);
      const concat = context.mock.method(Buffer, 'concat');
      const replies: SolidisData[] = [];

      for (let offset = 0; offset < stream.length; offset += 1) {
        replies.push(...parser.parse(stream.subarray(offset, offset + 1)));
      }

      const largest = concat.mock.calls.reduce(
        (length, call) => Math.max(length, call.arguments[0].length),
        0,
      );

      assert.deepStrictEqual(replies, [Buffer.alloc(size, 'x')]);
      assert.ok(
        largest <= Math.ceil(size / 1024) + 2,
        `${largest} chunks in one copy`,
      );
    });

    it('reads no number from integer and length lines longer than 64 bits allow', () => {
      const [integer] = parseOnce(bytes(`:${'9'.repeat(21)}\r\n`));

      assert.ok(integer instanceof RespError);
      assert.deepStrictEqual(parseOnce(bytes(':-9223372036854775808\r\n')), [
        -9223372036854775808n,
      ]);
      assert.throws(
        () => parseOnce(bytes(`$${'1'.repeat(21)}\r\n`)),
        isParserError(`Invalid length '${'1'.repeat(21)}'`),
      );
    });

    it('reads big numbers of up to 4096 digits', () => {
      const [limit] = parseOnce(bytes(`(${'7'.repeat(4096)}\r\n`));
      const [beyond] = parseOnce(bytes(`(${'7'.repeat(4097)}\r\n`));

      assert.strictEqual(limit, BigInt('7'.repeat(4096)));
      assert.ok(beyond instanceof RespError);
    });

    it('quotes only the start of a malformed line in its error', () => {
      const line = 'x'.repeat(1000);
      const preview = `'${'x'.repeat(32)}...'`;
      const [integer, double, number] = parseOnce(
        bytes(`:${line}\r\n,${line}\r\n(${line}\r\n`),
      );

      assert.ok(integer instanceof RespError);
      assert.strictEqual(integer.message, `Integer: ${preview}`);
      assert.ok(double instanceof RespError);
      assert.strictEqual(double.message, `Double: ${preview}`);
      assert.ok(number instanceof RespError);
      assert.strictEqual(number.message, `BigNumber: ${preview}`);
      assert.throws(
        () => parseOnce(bytes(`$${line}\r\n`)),
        isParserError(`Invalid length ${preview}`),
      );
      assert.throws(
        () => parseOnce(bytes(`#${line}\r\n`)),
        isParserError(`Boolean: invalid value ${preview}`),
      );

      const [long] = parseOnce(bytes(`(${'7'.repeat(5000)}\r\n`));

      assert.ok(long instanceof RespError);
      assert.strictEqual(long.message, `BigNumber: '${'7'.repeat(32)}...'`);

      const [exact, over] = parseOnce(
        bytes(`,${'x'.repeat(32)}\r\n,${'x'.repeat(33)}\r\n`),
      );

      assert.ok(exact instanceof RespError && over instanceof RespError);
      assert.strictEqual(exact.message, `Double: '${'x'.repeat(32)}'`);
      assert.strictEqual(over.message, `Double: '${'x'.repeat(32)}...'`);
    });

    it('rejects an over-long line even when its CRLF arrives with it', () => {
      for (const chunks of [
        [`+${'a'.repeat(100)}\r\n`],
        ['+aaaaa', `${'a'.repeat(95)}\r\n`],
      ]) {
        const parser = new SolidisParser({
          parser: { maxBulkStringLength: 10 },
        });

        assert.throws(() => {
          for (const chunk of chunks) {
            parser.parse(bytes(chunk));
          }
        }, isParserError('Line length exceeds maximum allowed 10'));
      }
    });

    it('waits for a CRLF before joining the chunks of a line full of line feeds', (context) => {
      const parser = createParser();
      const replies = parser.parse(bytes('+'));
      const concat = context.mock.method(Buffer, 'concat');

      for (let index = 0; index < 100; index += 1) {
        replies.push(...parser.parse(bytes('a\n'.repeat(512))));
      }

      replies.push(...parser.parse(bytes('\r\n')));

      assert.strictEqual(concat.mock.callCount(), 1);
      assert.deepStrictEqual(replies, ['a\n'.repeat(51200)]);
    });

    it('ends a line whose CR and LF arrive in separate chunks', () => {
      assert.deepStrictEqual(
        parseOnce(bytes('+'), bytes('O'), bytes('K\r'), bytes('\n')),
        ['OK'],
      );
      assert.deepStrictEqual(parseOnce(bytes('+OK\r'), bytes('\n')), ['OK']);
    });

    it('refuses a CR that no LF follows as soon as it arrives', () => {
      for (const chunks of [
        ['+OK\rX'],
        ['+OK', '\rX'],
        ['+OK\r', 'X'],
        ['+O', 'K\rX'],
        ['+OK', '\r', 'X'],
      ]) {
        const parser = createParser();

        assert.throws(
          () => {
            for (const chunk of chunks) {
              parser.parse(bytes(chunk));
            }
          },
          isParserError('Missing CRLF'),
          JSON.stringify(chunks),
        );
      }
    });

    it('joins the chunks of a bulk string once, when its last byte arrives', (context) => {
      const parser = createParser();
      const payload = Buffer.alloc(1024 * 1024, 0x61);
      const frame = Buffer.concat([
        bytes(`$${payload.length}\r\n`),
        payload,
        bytes('\r\n'),
      ]);
      const concat = context.mock.method(Buffer, 'concat');
      const replies: SolidisData[] = [];

      for (let offset = 0; offset < frame.length; offset += 65536) {
        replies.push(...parser.parse(frame.subarray(offset, offset + 65536)));
      }

      assert.strictEqual(concat.mock.callCount(), 1);
      assert.deepStrictEqual(replies, [payload]);
    });

    it('accepts a bulk string exactly at the configured maximum', () => {
      const parser = new SolidisParser({
        parser: { maxBulkStringLength: 4 },
      });

      assert.deepStrictEqual(parser.parse(bytes('$4\r\nabcd\r\n')), [
        bytes('abcd'),
      ]);
    });
  });

  describe('streaming the nastiest frames one byte at a time', () => {
    it('reassembles a map split across single-byte chunks', () => {
      const parser = createParser();
      const frame = bytes('%2\r\n+a\r\n:1\r\n+b\r\n:2\r\n');
      const collected: SolidisData[] = [];

      for (let index = 0; index < frame.length; index += 1) {
        collected.push(...parser.parse(frame.subarray(index, index + 1)));
      }

      assert.deepStrictEqual(collected, [
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ]);
    });
  });

  describe('bulk buffer ownership', () => {
    it('returns a bulk reply as a view of the received chunk', () => {
      const parser = createParser();
      const chunk = bytes('$5\r\nhello\r\n');

      const [reply] = parser.parse(chunk);

      assert.ok(Buffer.isBuffer(reply));
      assert.deepStrictEqual(reply, bytes('hello'));
      assert.strictEqual(reply.buffer, chunk.buffer);
      assert.strictEqual(reply.byteOffset, chunk.byteOffset + 4);
    });

    it('keeps a returned bulk buffer stable after caller mutation and later parses', () => {
      const parser = createParser();

      const [first] = parser.parse(bytes('$3\r\nabc\r\n'));

      if (!Buffer.isBuffer(first)) {
        assert.fail('expected first reply to be a Buffer');
      }

      first.fill(0);

      const [second] = parser.parse(bytes('$3\r\nxyz\r\n'));

      assert.deepStrictEqual(first, Buffer.alloc(3));
      assert.deepStrictEqual(second, bytes('xyz'));
    });

    it('does not mutate a held bulk buffer when later replies are parsed', () => {
      const parser = createParser();
      const payload = 'x'.repeat(256);
      const [bulk] = parser.parse(
        bytes(`$${payload.length}\r\n${payload}\r\n`),
      );

      if (!Buffer.isBuffer(bulk)) {
        assert.fail('expected bulk reply to be a Buffer');
      }

      const snapshot = Buffer.from(bulk);

      parser.parse(bytes('+OK\r\n'.repeat(30)));

      assert.deepStrictEqual(bulk, snapshot);
    });

    it('returns bulk strings of every length as views', () => {
      for (const [length, isView] of [
        [5, true],
        [65_535, true],
        [65_536, true],
        [70_000, true],
      ] as const) {
        const frame = Buffer.concat([
          bytes(`$${length}\r\n`),
          Buffer.alloc(length, 0x62),
          bytes('\r\n'),
        ]);
        const [reply] = parseOnce(frame);

        frame.fill(0x63);

        assert.ok(Buffer.isBuffer(reply));
        assert.strictEqual(reply.length, length);
        assert.strictEqual(
          reply.every((byte) => byte === 0x63),
          isView,
          `${length}`,
        );
      }
    });

    it('reassembles a bulk body split across chunks', () => {
      const parser = createParser();
      const payload = 'x'.repeat(256);

      assert.deepStrictEqual(
        parser.parse(bytes(`$${payload.length}\r\n`)),
        [],
        'an incomplete bulk header must wait for body bytes',
      );
      assert.deepStrictEqual(
        parser.parse(bytes(payload.slice(0, 200))),
        [],
        'a partial bulk body must wait for the remainder',
      );

      const result = parser.parse(bytes(`${payload.slice(200)}\r\n`));

      assert.deepStrictEqual(result, [Buffer.from(payload, 'latin1')]);
    });

    it('copies only the rest of a bulk string from the chunk that ends it and parses the remainder in place', (context) => {
      const parser = createParser();
      const concat = context.mock.method(Buffer, 'concat');

      assert.deepStrictEqual(parser.parse(bytes('$10\r\n01234')), []);
      assert.deepStrictEqual(
        parser.parse(bytes('56789\r\n+OK\r\n:5\r\n$3\r\nab')),
        [bytes('0123456789'), 'OK', 5],
      );
      assert.strictEqual(concat.mock.callCount(), 1);
      assert.strictEqual(concat.mock.calls[0].result?.length, 17);
      assert.deepStrictEqual(parser.parse(bytes('c\r\n')), [bytes('abc')]);
      assert.deepStrictEqual(parser.parse(bytes('+next\r\n')), ['next']);
    });

    it('limits the content of a line the same way however the chunks split it', () => {
      const parse = (chunks: string[]) => {
        const parser = new SolidisParser({
          ...SolidisDefaultOptions,
          parser: { maxBulkStringLength: 10 },
        });

        return chunks.flatMap((chunk) => parser.parse(Buffer.from(chunk)));
      };

      for (const chunks of [
        ['+aaaaaaaaaa\r\n'],
        ['+aaaaa', 'aaaaa\r\n'],
        ['+aaaaa', 'aaaaa', '\r\n'],
        ['+aaaaa', 'aaaaa\r', '\n'],
        ['+a', 'aaaa', 'aaaa', 'a\r', '\n'],
      ]) {
        assert.deepStrictEqual(parse(chunks), ['aaaaaaaaaa']);
      }

      for (const chunks of [
        ['+aaaaaaaaaaa\r\n'],
        ['+aaaaa', 'aaaaaa', '\r\n'],
        ['+aaaaa', 'aaaaa', 'a\r', '\n'],
      ]) {
        assert.throws(() => parse(chunks), {
          name: 'SolidisParserError',
          message: 'Line length exceeds maximum allowed 10',
        });
      }
    });

    it('returns a bulk string that follows a line split across chunks as a view of its own chunk', () => {
      const parser = new SolidisParser(SolidisDefaultOptions);
      const line = `+${'a'.repeat(200_000)}`;
      const replies = [
        ...parser.parse(Buffer.from(line.slice(0, 60_000))),
        ...parser.parse(Buffer.from(line.slice(60_000, 120_000))),
        ...parser.parse(Buffer.from(line.slice(120_000, 180_000))),
        ...parser.parse(Buffer.from(`${line.slice(180_000)}\r\n$3\r\nabc\r\n`)),
      ];
      const [text, bulk] = replies;

      assert.strictEqual(text, 'a'.repeat(200_000));
      assert.ok(Buffer.isBuffer(bulk));
      assert.strictEqual(bulk.toString(), 'abc');
      assert.ok(bulk.buffer.byteLength < 30_000);
    });

    it('starts the next chunk clean after a bulk string that ends exactly at a chunk end', () => {
      const parser = createParser();

      assert.deepStrictEqual(parser.parse(bytes('$3\r\na')), []);
      assert.deepStrictEqual(parser.parse(bytes('bc\r\n')), [bytes('abc')]);
      assert.deepStrictEqual(parser.parse(bytes('+OK\r\n')), ['OK']);
    });

    it('keeps waiting on a line that the rest of a bulk chunk starts and a CR|LF split ends', () => {
      const parser = createParser();

      assert.deepStrictEqual(parser.parse(bytes('$1\r\n')), []);
      assert.deepStrictEqual(parser.parse(bytes('x\r\n+O')), [bytes('x')]);
      assert.deepStrictEqual(parser.parse(bytes('K\r')), []);
      assert.deepStrictEqual(parser.parse(bytes('\n:1\r\n')), ['OK', 1]);
    });

    it('completes an array whose bulk element ends in the next chunk', () => {
      const parser = createParser();

      assert.deepStrictEqual(parser.parse(bytes('*2\r\n$3\r\nab')), []);
      assert.deepStrictEqual(parser.parse(bytes('c\r\n:7\r\n')), [
        [bytes('abc'), 7],
      ]);
    });

    it('resumes a truncated simple string followed by many replies', () => {
      const parser = createParser();

      assert.deepStrictEqual(parser.parse(bytes('+O')), []);
      assert.deepStrictEqual(
        parser.parse(bytes(`K\r\n${'+OK\r\n'.repeat(19)}`)),
        Array.from({ length: 20 }, () => 'OK'),
      );
    });

    it('handles consecutive large payloads', () => {
      const parser = createParser();

      for (let round = 0; round < 3; round += 1) {
        const payload = 'y'.repeat(128 * (round + 1));
        const frame = bytes(`$${payload.length}\r\n${payload}\r\n`);

        assert.deepStrictEqual(parser.parse(frame), [
          Buffer.from(payload, 'latin1'),
        ]);
      }
    });

    it('releases a fully consumed chunk and starts the next one clean', () => {
      const parser = createParser();

      assert.deepStrictEqual(parser.parse(bytes('+a\r\n')), ['a']);
      assert.deepStrictEqual(parser.parse(bytes('+b\r\n+c')), ['b']);
      assert.deepStrictEqual(parser.parse(bytes('\r\n')), ['c']);
    });
  });

  describe('malformed RESP3 null and integer edge cases', () => {
    it('waits for more data when a malformed integer frame lacks CRLF', () => {
      assert.deepStrictEqual(parseOnce(bytes(':12ab')), []);
    });

    it('reassembles a RESP3 null reply delivered across two chunks', () => {
      const parser = createParser();

      assert.deepStrictEqual(
        parser.parse(bytes('_\r')),
        [],
        'a null marker without its LF byte must wait for the next chunk',
      );
      assert.deepStrictEqual(parser.parse(bytes('\n')), [null]);
    });

    it('throws a parser error for a RESP3 null with a payload', () => {
      assert.throws(
        () => parseOnce(bytes('_X\r\n')),
        isParserError('Null: unexpected payload'),
      );
    });
  });

  describe('boolean byte validation', () => {
    it('rejects an invalid boolean byte that is neither t nor f', () => {
      assert.throws(
        () => parseOnce(bytes('#x\r\n')),
        isParserError("Boolean: invalid value 'x'"),
        'silently returning false for arbitrary bytes masks protocol corruption',
      );
    });

    it('rejects every non-canonical boolean value as a parse error', () => {
      const invalidValues = ['a', 'b', 'z', '1', '0', 'T', 'F', '!', 'tt', ''];

      for (const value of invalidValues) {
        assert.throws(
          () => parseOnce(bytes(`#${value}\r\n`)),
          isParserError(`Boolean: invalid value '${value}'`),
          `boolean value "${value}" must throw a SolidisParserError`,
        );
      }
    });
  });

  describe('integer BigInt auto-promotion', () => {
    it('promotes a 16-digit integer exceeding MAX_SAFE_INTEGER to BigInt', () => {
      assert.deepStrictEqual(parseOnce(bytes(':9007199254740993\r\n')), [
        9007199254740993n,
      ]);
    });

    it('keeps a 15-digit integer within safe range as a number', () => {
      assert.deepStrictEqual(
        parseOnce(bytes(':999999999999999\r\n')),
        [999999999999999],
      );
    });

    it('promotes a negative integer beyond safe range to BigInt', () => {
      assert.deepStrictEqual(parseOnce(bytes(':-9007199254740993\r\n')), [
        -9007199254740993n,
      ]);
    });

    it('keeps Number.MAX_SAFE_INTEGER as a number', () => {
      assert.deepStrictEqual(parseOnce(bytes(':9007199254740991\r\n')), [
        Number.MAX_SAFE_INTEGER,
      ]);
    });

    it('promotes 2^53 itself to BigInt', () => {
      assert.deepStrictEqual(parseOnce(bytes(':9007199254740992\r\n')), [
        9007199254740992n,
      ]);
    });

    it('promotes a 20-digit integer to BigInt', () => {
      assert.deepStrictEqual(parseOnce(bytes(':92233720368547758070\r\n')), [
        92233720368547758070n,
      ]);
    });

    it('handles BigInt integer split across chunks', () => {
      const parser = createParser();

      assert.deepStrictEqual(parser.parse(bytes(':900719925474')), []);
      assert.deepStrictEqual(parser.parse(bytes('0993\r\n')), [
        9007199254740993n,
      ]);
    });
  });
});
