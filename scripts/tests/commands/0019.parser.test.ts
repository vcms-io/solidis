/** Protocol-level fuzzing of the RESP parser. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RespError,
  SolidisDefaultOptions,
  SolidisParser,
  SolidisParserError,
} from '../../../sources/index.ts';
import { RespPush } from '../../../sources/types/resp.ts';
import { assertGrowth, measureTime } from '../utils/index.ts';

import type { SolidisData } from '../../../sources/index.ts';

/** Builds a buffer from a latin1 string so control bytes map 1:1. */
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

/** Deterministic PRNG so every fuzz failure is reproducible. */
function createRandom(seed: number) {
  let state = seed;

  return (limit: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;

    return state % limit;
  };
}

function splitRandomly(frame: Buffer, random: (limit: number) => number) {
  const chunks: Buffer[] = [];

  let offset = 0;

  while (offset < frame.length) {
    const size = 1 + random(Math.min(64, frame.length - offset));

    chunks.push(frame.subarray(offset, offset + size));
    offset += size;
  }

  return chunks;
}

const mixedStream = bytes(
  [
    '+OK\r\n',
    '-ERR failure\r\n',
    ':42\r\n',
    ':-9007199254740993\r\n',
    '$5\r\nhello\r\n',
    '$0\r\n\r\n',
    '$-1\r\n',
    '*3\r\n:1\r\n$2\r\nab\r\n*1\r\n+nested\r\n',
    '*0\r\n',
    '*-1\r\n',
    '_\r\n',
    '#t\r\n',
    ',3.5\r\n',
    ',-inf\r\n',
    '(12345678901234567890\r\n',
    '=15\r\ntxt:hello world\r\n',
    '!21\r\nSYNTAX invalid syntax\r\n',
    '%2\r\n+a\r\n:1\r\n+b\r\n*2\r\n:2\r\n:3\r\n',
    '~2\r\n+x\r\n+y\r\n',
    '>3\r\n$7\r\nmessage\r\n$2\r\nch\r\n$4\r\nbody\r\n',
    '|1\r\n+meta\r\n+data\r\n+after-attribute\r\n',
    '*2\r\n|1\r\n+meta\r\n+data\r\n:1\r\n:2\r\n',
  ].join(''),
);

describe('parser', () => {
  it('parses a simple string', () => {
    assert.deepStrictEqual(parseOnce(bytes('+OK\r\n')), ['OK']);
  });

  it('parses an error into a RespError with its code', () => {
    const [reply] = parseOnce(bytes('-ERR something failed\r\n'));

    if (!(reply instanceof RespError)) {
      assert.fail('expected a RespError for error reply');
    }

    assert.strictEqual(reply.message, 'ERR something failed');
    assert.strictEqual(reply.code, 'ERR');
  });

  it('parses positive, negative, and zero integers', () => {
    assert.deepStrictEqual(parseOnce(bytes(':12345\r\n')), [12345]);
    assert.deepStrictEqual(parseOnce(bytes(':-9999\r\n')), [-9999]);
    assert.deepStrictEqual(parseOnce(bytes(':0\r\n')), [0]);
  });

  it('parses a bulk string into a Buffer', () => {
    const [reply] = parseOnce(bytes('$5\r\nhello\r\n'));

    assert.deepStrictEqual(reply, bytes('hello'));
  });

  it('keeps CRLF inside a bulk payload (binary safe)', () => {
    const payload = bytes('a\r\nb');
    const frame = Buffer.concat([bytes('$4\r\n'), payload, bytes('\r\n')]);

    const [reply] = parseOnce(frame);

    assert.deepStrictEqual(reply, payload);
  });

  it('parses every byte value inside a bulk payload', () => {
    const payload = Buffer.from(
      Array.from({ length: 256 }, (_unused, index) => index),
    );
    const frame = Buffer.concat([
      bytes(`$${payload.length}\r\n`),
      payload,
      bytes('\r\n'),
    ]);

    const [reply] = parseOnce(frame);

    assert.deepStrictEqual(reply, payload);
  });

  it('parses null and empty bulk strings', () => {
    assert.deepStrictEqual(parseOnce(bytes('$-1\r\n')), [null]);

    const [empty] = parseOnce(bytes('$0\r\n\r\n'));

    assert.deepStrictEqual(empty, Buffer.alloc(0));
  });

  it('parses flat and nested arrays', () => {
    assert.deepStrictEqual(parseOnce(bytes('*3\r\n:1\r\n:2\r\n:3\r\n')), [
      [1, 2, 3],
    ]);

    const [nested] = parseOnce(bytes('*2\r\n*2\r\n:1\r\n:2\r\n$3\r\nfoo\r\n'));

    assert.deepStrictEqual(nested, [[1, 2], bytes('foo')]);
  });

  it('parses null and empty arrays', () => {
    assert.deepStrictEqual(parseOnce(bytes('*-1\r\n')), [null]);
    assert.deepStrictEqual(parseOnce(bytes('*0\r\n')), [[]]);
  });

  it('parses RESP3 null, booleans, and doubles', () => {
    assert.deepStrictEqual(parseOnce(bytes('_\r\n')), [null]);
    assert.deepStrictEqual(parseOnce(bytes('#t\r\n')), [true]);
    assert.deepStrictEqual(parseOnce(bytes('#f\r\n')), [false]);
    assert.deepStrictEqual(parseOnce(bytes(',3.14\r\n')), [3.14]);
    assert.deepStrictEqual(parseOnce(bytes(',inf\r\n')), [
      Number.POSITIVE_INFINITY,
    ]);
    assert.deepStrictEqual(parseOnce(bytes(',-inf\r\n')), [
      Number.NEGATIVE_INFINITY,
    ]);

    const [nan] = parseOnce(bytes(',nan\r\n'));

    assert.strictEqual(Number.isNaN(nan), true);
  });

  it('parses a RESP3 big number into a bigint', () => {
    const [reply] = parseOnce(
      bytes('(3492890328409238509324850943850943825024385\r\n'),
    );

    assert.strictEqual(reply, 3492890328409238509324850943850943825024385n);
  });

  it('strips the format prefix of a RESP3 verbatim string', () => {
    assert.deepStrictEqual(parseOnce(bytes('=15\r\ntxt:hello world\r\n')), [
      'hello world',
    ]);
    assert.deepStrictEqual(parseOnce(bytes('=8\r\nmkd:# md\r\n')), ['# md']);
  });

  it('parses a RESP3 map into a Map', () => {
    const [reply] = parseOnce(bytes('%2\r\n+a\r\n:1\r\n+b\r\n:2\r\n'));

    if (!(reply instanceof Map)) {
      assert.fail('expected a Map for RESP3 map reply');
    }

    assert.deepStrictEqual(
      [...reply],
      [
        ['a', 1],
        ['b', 2],
      ],
    );
  });

  it('parses a RESP3 set into a Set', () => {
    const [reply] = parseOnce(bytes('~3\r\n:1\r\n:2\r\n:3\r\n'));

    if (!(reply instanceof Set)) {
      assert.fail('expected a Set for RESP3 set reply');
    }

    assert.deepStrictEqual([...reply].sort(), [1, 2, 3]);
  });

  it('parses a RESP3 push message', () => {
    const [reply] = parseOnce(bytes('>2\r\n+pubsub\r\n+hello\r\n'));

    if (!(reply instanceof RespPush)) {
      assert.fail('expected a RespPush instance for RESP3 push reply');
    }

    assert.strictEqual(reply.length, 2);
    assert.strictEqual(reply[0], 'pubsub');
    assert.strictEqual(reply[1], 'hello');
  });

  it('parses an empty RESP3 push as a RespPush', () => {
    const [reply] = parseOnce(bytes('>0\r\n'));

    assert.ok(reply instanceof RespPush);
    assert.strictEqual(reply.length, 0);
  });

  it('ignores attributes and surfaces the following reply', () => {
    const [reply] = parseOnce(
      bytes('|1\r\n+key-popularity\r\n+0.42\r\n+actual\r\n'),
    );

    assert.strictEqual(reply, 'actual');
  });

  it('does not count an attribute as an element of the enclosing aggregate', () => {
    assert.deepStrictEqual(
      parseOnce(bytes('*2\r\n|1\r\n+meta\r\n+data\r\n:1\r\n:2\r\n+next\r\n')),
      [[1, 2], 'next'],
    );
  });

  it('parses multiple replies from one buffer', () => {
    assert.deepStrictEqual(parseOnce(bytes('+A\r\n+B\r\n:3\r\n')), [
      'A',
      'B',
      3,
    ]);
  });

  it('reassembles a frame split across two chunks', () => {
    const parser = createParser();

    assert.deepStrictEqual(parser.parse(bytes('$5\r\nhel')), []);

    const [reply] = parser.parse(bytes('lo\r\n'));

    assert.deepStrictEqual(reply, bytes('hello'));
  });

  it('reassembles a frame delivered one byte at a time', () => {
    const parser = createParser();
    const frame = bytes('*2\r\n$3\r\nfoo\r\n:42\r\n');
    const collected: SolidisData[] = [];

    for (let index = 0; index < frame.length; index += 1) {
      collected.push(...parser.parse(frame.subarray(index, index + 1)));
    }

    assert.deepStrictEqual(collected, [[bytes('foo'), 42]]);
  });

  it('parses a multi-megabyte bulk delivered in socket-sized chunks', () => {
    const size = 5 * 1024 * 1024;
    const payload = Buffer.alloc(size, 0x61);
    const frame = Buffer.concat([
      bytes(`$${size}\r\n`),
      payload,
      bytes('\r\n+after\r\n'),
    ]);
    const parser = createParser();
    const collected: SolidisData[] = [];

    for (let offset = 0; offset < frame.length; offset += 65536) {
      collected.push(...parser.parse(frame.subarray(offset, offset + 65536)));
    }

    assert.strictEqual(collected.length, 2);
    assert.ok(Buffer.isBuffer(collected[0]));
    assert.ok(collected[0].equals(payload));
    assert.strictEqual(collected[1], 'after');
  });

  it('refuses a deeply nested array without overflowing the stack', () => {
    const frame = Buffer.concat([
      Buffer.from('*1\r\n'.repeat(100000), 'latin1'),
      bytes(':1\r\n'),
    ]);

    assert.throws(() => parseOnce(frame), {
      name: 'SolidisParserError',
      message: 'Nesting exceeds maximum depth 512',
    });
  });

  it('produces identical replies however the stream is split', () => {
    const expected = parseOnce(mixedStream);

    assert.strictEqual(expected.length, 22);

    for (let seed = 1; seed <= 300; seed += 1) {
      const chunks = splitRandomly(mixedStream, createRandom(seed));

      assert.deepStrictEqual(parseOnce(...chunks), expected, `seed ${seed}`);
    }
  });

  it('parses every prefix split of the stream without losing or duplicating replies', () => {
    const expected = parseOnce(mixedStream);

    for (let offset = 1; offset < mixedStream.length; offset += 1) {
      const actual = parseOnce(
        mixedStream.subarray(0, offset),
        mixedStream.subarray(offset),
      );

      assert.deepStrictEqual(actual, expected, `split at ${offset}`);
    }
  });

  it('keeps parsing time linear in the size of a chunked aggregate', async () => {
    await assertGrowth(
      (elementCount) => {
        const parts = [bytes(`*${elementCount}\r\n`)];

        for (let index = 0; index < elementCount; index += 1) {
          parts.push(bytes(`$8\r\n${`${index}`.padStart(8, '0')}\r\n`));
        }

        const frame = Buffer.concat(parts);
        const parser = createParser();

        let replies: SolidisData[] = [];

        return measureTime(() => {
          for (let offset = 0; offset < frame.length; offset += 65536) {
            replies = replies.concat(
              parser.parse(frame.subarray(offset, offset + 65536)),
            );
          }

          assert.strictEqual(replies.length, 1);
          assert.strictEqual(
            (replies[0] as SolidisData[]).length,
            elementCount,
          );
        });
      },
      [12_500, 100_000],
      16,
    );
  });

  it('rejects an unknown type prefix', () => {
    assert.throws(() => parseOnce(bytes('@bogus\r\n')), {
      name: 'SolidisParserError',
      message: "Unknown prefix '@'",
    });
  });

  it('rejects an integer with a missing LF', () => {
    assert.throws(() => parseOnce(bytes(':12\r3\r\n')), {
      name: 'SolidisParserError',
      message: 'Missing CRLF',
    });
  });

  it('rejects a simple string with a bare CR', () => {
    assert.throws(() => parseOnce(bytes('+OK\rX\r\n')), {
      name: 'SolidisParserError',
      message: 'Missing CRLF',
    });
  });

  it('rejects a bulk payload that is not terminated by CRLF', () => {
    for (const reply of ['$3\r\nabcXY', '$3\r\nabc\rX', '$3\r\nabcX\n']) {
      assert.throws(
        () => parseOnce(bytes(reply)),
        { name: 'SolidisParserError', message: 'Missing CRLF' },
        JSON.stringify(reply),
      );
    }
  });

  it('rejects an aggregate length that is not a number', () => {
    assert.throws(
      () => parseOnce(bytes('*x\r\n')),
      (error: Error) =>
        error instanceof SolidisParserError &&
        error.message === "Invalid length 'x'",
    );
  });

  it('keeps the replies before a corrupt frame and then throws', () => {
    const replies: SolidisData[] = [];

    assert.throws(
      () => createParser().parse(bytes('+good\r\n@evil\r\n'), replies),
      { message: "Unknown prefix '@'" },
    );
    assert.deepStrictEqual(replies, ['good']);
  });

  it('waits for more data on an incomplete frame', () => {
    assert.deepStrictEqual(parseOnce(bytes('$10\r\nshort')), []);
    assert.deepStrictEqual(parseOnce(bytes('*3\r\n:1\r\n')), []);
    assert.deepStrictEqual(parseOnce(bytes('%2\r\n+a\r\n:1\r\n')), []);
    assert.deepStrictEqual(parseOnce(bytes('+OK\r')), []);
  });
});
