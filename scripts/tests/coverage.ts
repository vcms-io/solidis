/**
 * Unified coverage runner.
 *
 * commands: parallel. client/admin: serial, alone (global state).
 * client/{core,resilience,fault}: serial per group, groups in parallel.
 * Uses NODE_V8_COVERAGE + native TS stripping for per-file identity.
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
  if (files.length === 0) {
    return Promise.resolve(0);
  }

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
const adminCode = await spawnTests(listTests('client/admin'), 1);
const restCodes = await Promise.all(
  ['client/core', 'client/resilience', 'client/fault'].map((group) =>
    spawnTests(listTests(group), 1),
  ),
);

await report();

rmSync(coverageDirectory, { recursive: true });

const allCodes = [commandsCode, adminCode, ...restCodes];

if (allCodes.some((code) => code !== 0)) {
  process.exit(1);
}
