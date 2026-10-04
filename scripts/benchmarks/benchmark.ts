import { createBenchmarkRunner } from './shared/runner.ts';
import { comparisonSuite } from './suite.ts';

const { entrypoint } = createBenchmarkRunner(comparisonSuite, import.meta.url);

entrypoint().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
