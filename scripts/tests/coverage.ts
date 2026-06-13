/**
 * Unified coverage runner.
 *
 * The two test tiers cannot share a single process: command suites are
 * timing-sensitive and must run in isolated child processes (in parallel),
 * while client suites mutate global server state and must run serially. To
 * still produce one merged coverage report, both tiers write raw V8 coverage
 * into a shared directory via NODE_V8_COVERAGE, which c8 then merges.
 *
 * Child processes use native TypeScript stripping rather than the esbuild
 * loader so each source module keeps its own file identity (the loader bundles
 * everything inline, which hides sources/ from V8 coverage).
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(base, '../..');
const coverageDirectory = join(root, '.coverage');

if (existsSync(coverageDirectory)) {
  rmSync(coverageDirectory, { recursive: true });
}

mkdirSync(coverageDirectory, { recursive: true });

function listTests(group: string): string[] {
  return readdirSync(join(base, group))
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => join(base, group, file));
}

function spawnTests(files: string[], concurrency?: number): Promise<number> {
  const command = [
    '--experimental-strip-types',
    '--no-warnings',
    '--test',
    ...(concurrency === undefined ? [] : [`--test-concurrency=${concurrency}`]),
    ...files,
  ];

  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, command, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NODE_V8_COVERAGE: coverageDirectory },
    });

    child.on('close', (code) => resolvePromise(code ?? 1));
  });
}

function report(): Promise<number> {
  const command = [
    'c8',
    'report',
    `--temp-directory=${coverageDirectory}`,
    '--include=sources/**/*.ts',
    '--reporter=text',
    '--reporter=text-summary',
  ];

  return new Promise((resolvePromise) => {
    const child = spawn('npx', command, {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => resolvePromise(code ?? 1));
  });
}

const commandsCode = await spawnTests(listTests('commands'));
const clientCode = await spawnTests(listTests('client'), 1);

await report();

rmSync(coverageDirectory, { recursive: true });

process.exitCode = commandsCode === 0 && clientCode === 0 ? 0 : 1;
