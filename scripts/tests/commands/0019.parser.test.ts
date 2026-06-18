/** Protocol-level fuzzing of the RESP parser. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RespError,
  SolidisDefaultOptions,
  SolidisParser,
} from '../../../sources/index.ts';
import { RespPush } from '../../../sources/types/resp.ts';

import type { SolidisData } from '../../../sources/index.ts';

/** Builds a buffer from a latin1 string so control bytes map 1:1. */
function bytes(input: string): Buffer {
  return Buffer.from(input, 'latin1');
}

function createParser(): SolidisParser {
  return new SolidisParser(SolidisDefaultOptions);
}

async function parseOnce(...chunks: Buffer[]): Promise<SolidisData[]> {
  return createParser().queueParse(...chunks);
}

describe('parser', () => {
  it('parses a simple string', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('+OK\r\n')), ['OK']);
  });

  it('parses an error into a RespError', async () => {
    const [reply] = await parseOnce(bytes('-ERR something failed\r\n'));

    if (!(reply instanceof RespError)) {
      assert.fail('expected a RespError for error reply');
    }
    assert.strictEqual(reply.message, 'ERR something failed');
  });

  it('parses positive, negative, and zero integers', async () => {
    assert.deepStrictEqual(await parseOnce(bytes(':12345\r\n')), [12345]);
    assert.deepStrictEqual(await parseOnce(bytes(':-9999\r\n')), [-9999]);
    assert.deepStrictEqual(await parseOnce(bytes(':0\r\n')), [0]);
  });

  it('parses a bulk string into a Buffer', async () => {
    const [reply] = await parseOnce(bytes('$5\r\nhello\r\n'));

    assert.deepStrictEqual(reply, bytes('hello'));
  });

  it('keeps CRLF inside a bulk payload (binary safe)', async () => {
    const payload = bytes('a\r\nb');
    const frame = Buffer.concat([bytes('$4\r\n'), payload, bytes('\r\n')]);

    const [reply] = await parseOnce(frame);

    assert.deepStrictEqual(reply, payload);
  });

  it('parses every byte value inside a bulk payload', async () => {
    const payload = Buffer.from(
      Array.from({ length: 256 }, (_unused, index) => index),
    );
    const frame = Buffer.concat([
      bytes(`$${payload.length}\r\n`),
      payload,
      bytes('\r\n'),
    ]);

    const [reply] = await parseOnce(frame);

    assert.deepStrictEqual(reply, payload);
  });

  it('parses null and empty bulk strings', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('$-1\r\n')), [null]);

    const [empty] = await parseOnce(bytes('$0\r\n\r\n'));

    assert.deepStrictEqual(empty, Buffer.alloc(0));
  });

  it('parses flat and nested arrays', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('*3\r\n:1\r\n:2\r\n:3\r\n')), [
      [1, 2, 3],
    ]);

    const [nested] = await parseOnce(
      bytes('*2\r\n*2\r\n:1\r\n:2\r\n$3\r\nfoo\r\n'),
    );

    assert.deepStrictEqual(nested, [[1, 2], bytes('foo')]);
  });

  it('parses null and empty arrays', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('*-1\r\n')), [null]);
    assert.deepStrictEqual(await parseOnce(bytes('*0\r\n')), [[]]);
  });

  it('parses RESP3 null, booleans, and doubles', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('_\r\n')), [null]);
    assert.deepStrictEqual(await parseOnce(bytes('#t\r\n')), [true]);
    assert.deepStrictEqual(await parseOnce(bytes('#f\r\n')), [false]);
    assert.deepStrictEqual(await parseOnce(bytes(',3.14\r\n')), [3.14]);
    assert.deepStrictEqual(await parseOnce(bytes(',inf\r\n')), [
      Number.POSITIVE_INFINITY,
    ]);
    assert.deepStrictEqual(await parseOnce(bytes(',-inf\r\n')), [
      Number.NEGATIVE_INFINITY,
    ]);

    const [nan] = await parseOnce(bytes(',nan\r\n'));

    assert.strictEqual(Number.isNaN(nan), true);
  });

  it('parses a RESP3 big number into a bigint', async () => {
    const [reply] = await parseOnce(
      bytes('(3492890328409238509324850943850943825024385\r\n'),
    );

    assert.strictEqual(reply, 3492890328409238509324850943850943825024385n);
  });

  it('parses a RESP3 verbatim string', async () => {
    const [reply] = await parseOnce(bytes('=15\r\ntxt:hello world\r\n'));

    assert.strictEqual(reply, 'txt:hello world');
  });

  it('parses a RESP3 map into a Map', async () => {
    const [reply] = await parseOnce(bytes('%2\r\n+a\r\n:1\r\n+b\r\n:2\r\n'));

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

  it('parses a RESP3 set into a Set', async () => {
    const [reply] = await parseOnce(bytes('~3\r\n:1\r\n:2\r\n:3\r\n'));

    if (!(reply instanceof Set)) {
      assert.fail('expected a Set for RESP3 set reply');
    }
    assert.deepStrictEqual([...reply].sort(), [1, 2, 3]);
  });

  it('parses a RESP3 push message', async () => {
    const [reply] = await parseOnce(bytes('>2\r\n+pubsub\r\n+hello\r\n'));

    if (!(reply instanceof RespPush)) {
      assert.fail('expected a RespPush instance for RESP3 push reply');
    }
    assert.strictEqual(reply.length, 2);
    assert.strictEqual(reply[0], 'pubsub');
    assert.strictEqual(reply[1], 'hello');
  });

  it('ignores attributes and surfaces the following reply', async () => {
    const [reply] = await parseOnce(
      bytes('|1\r\n+key-popularity\r\n+0.42\r\n+actual\r\n'),
    );

    assert.strictEqual(reply, 'actual');
  });

  it('parses multiple replies from one buffer', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('+A\r\n+B\r\n:3\r\n')), [
      'A',
      'B',
      3,
    ]);
  });

  it('reassembles a frame split across two chunks', async () => {
    const parser = createParser();

    assert.deepStrictEqual(await parser.queueParse(bytes('$5\r\nhel')), []);

    const [reply] = await parser.queueParse(bytes('lo\r\n'));

    assert.deepStrictEqual(reply, bytes('hello'));
  });

  it('reassembles a frame delivered one byte at a time', async () => {
    const parser = createParser();
    const frame = bytes('*2\r\n$3\r\nfoo\r\n:42\r\n');

    let collected: SolidisData[] = [];

    for (let index = 0; index < frame.length; index += 1) {
      collected = await parser.queueParse(frame.subarray(index, index + 1));
    }

    assert.strictEqual(collected.length, 1);
    assert.deepStrictEqual(collected[0], [bytes('foo'), 42]);
  });

  it('grows its internal buffer for a multi-megabyte bulk', async () => {
    const size = 5 * 1024 * 1024;
    const payload = Buffer.alloc(size, 0x61);
    const frame = Buffer.concat([
      bytes(`$${size}\r\n`),
      payload,
      bytes('\r\n'),
    ]);

    const [reply] = await parseOnce(frame);

    assert.deepStrictEqual(reply, payload);
  });

  it('parses a deeply nested array without overflowing', async () => {
    const depth = 64;

    let frame = bytes(':1\r\n');

    for (let level = 0; level < depth; level += 1) {
      frame = Buffer.concat([bytes('*1\r\n'), frame]);
    }

    const [reply] = await parseOnce(frame);

    let cursor: unknown = reply;

    for (let level = 0; level < depth; level += 1) {
      assert.ok(Array.isArray(cursor));

      cursor = cursor[0];
    }

    assert.strictEqual(cursor, 1);
  });

  it('rejects an unknown type prefix', async () => {
    await assert.rejects(parseOnce(bytes('@bogus\r\n')), {
      message: "Unknown prefix '@' in Solidis response",
    });
  });

  it('rejects an integer with a missing LF', async () => {
    await assert.rejects(parseOnce(bytes(':12\r3\r\n')), {
      message: 'Integer parse error: missing CRLF',
    });
  });

  it('rejects a simple string with a bare CR', async () => {
    await assert.rejects(parseOnce(bytes('+OK\rX\r\n')), {
      message: 'SimpleString parse error: missing CRLF',
    });
  });

  it('discards a valid reply when a later frame is corrupt', async () => {
    await assert.rejects(parseOnce(bytes('+good\r\n@evil\r\n')), {
      message: "Unknown prefix '@' in Solidis response",
    });
  });

  it('waits for more data on an incomplete frame', async () => {
    assert.deepStrictEqual(await parseOnce(bytes('$10\r\nshort')), []);
    assert.deepStrictEqual(await parseOnce(bytes('*3\r\n:1\r\n')), []);
    assert.deepStrictEqual(await parseOnce(bytes('%2\r\n+a\r\n:1\r\n')), []);
  });
});
