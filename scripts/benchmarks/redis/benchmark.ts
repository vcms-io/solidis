import { createBenchmarkRunner } from '../shared/runner.ts';
import { redisSuite } from './suite.ts';

const { entrypoint } = createBenchmarkRunner(redisSuite, import.meta.url);

entrypoint().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
