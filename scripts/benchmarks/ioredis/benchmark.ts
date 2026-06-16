import { createBenchmarkRunner } from '../shared/runner.ts';
import { ioredisSuite } from './suite.ts';

const { entrypoint } = createBenchmarkRunner(ioredisSuite, import.meta.url);

entrypoint().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
