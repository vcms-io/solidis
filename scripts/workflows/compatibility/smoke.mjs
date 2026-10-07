import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const portText = process.env.SOLIDIS_TEST_PORT?.trim() ?? '';
const port = Number(portText);

if (!/^\d+$/.test(portText) || port < 1 || port > 65_535) {
  throw new Error('Set SOLIDIS_TEST_PORT to a disposable server.');
}

const require = createRequire(import.meta.url);
const builds = {
  module: await import('../../../distributions/client/featured.mjs'),
  commonjs: require('../../../distributions/client/featured.cjs'),
};

for (const [format, { SolidisFeaturedClient }] of Object.entries(builds)) {
  const client = new SolidisFeaturedClient({ port, lazyConnect: true });
  const key = `solidis:compatibility:${format}`;
  const value = Buffer.from([0xff, 0x00, 0xfe]);

  await client.connect();

  assert.strictEqual(await client.set(key, value), 'OK');
  assert.deepStrictEqual(await client.get(key, { buffer: true }), value);
  await assert.rejects(client.incr(key), { name: 'SolidisCommandError' });
  assert.strictEqual(await client.del(key), 1);

  client.quit();

  console.log(`${format} build works on Node ${process.version}`);
}
