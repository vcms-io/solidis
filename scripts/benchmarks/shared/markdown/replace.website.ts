import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { en } from './locales/index.ts';
import { loadSnapshot, mergeSnapshots } from './snapshot.ts';

import type { ComparedResult, LibraryName } from '../types.ts';

interface WebsiteBenchmarkEntry {
  name: string;
  description: string;
  solidisMs: number;
  baselineMs: number;
  ratio: string;
}

function formatOperationName(
  raw: string,
  displayNames: Record<string, string>,
): { display: string; commands: string } {
  const colonIndex = raw.indexOf(':');
  const display = displayNames[raw] ?? raw;

  if (colonIndex === -1) {
    return {
      display,
      commands: `${raw.toUpperCase()} (1 KB payload)`,
    };
  }

  return {
    display,
    commands: raw
      .slice(colonIndex + 1)
      .split('+')
      .join(' + '),
  };
}

function buildWebsiteEntries(
  results: ComparedResult[],
  baselineLibrary: LibraryName,
): WebsiteBenchmarkEntry[] {
  const grouped = new Map<string, ComparedResult[]>();

  for (const result of results) {
    const key = `${result.operation}\x00${result.payloadBytes}`;
    const existing = grouped.get(key) ?? [];
    existing.push(result);
    grouped.set(key, existing);
  }

  const entries: WebsiteBenchmarkEntry[] = [];

  for (const groupResults of grouped.values()) {
    if (!groupResults.every((r) => r.comparable)) {
      continue;
    }

    const solidis = groupResults.find((r) => r.library !== baselineLibrary);
    const baseline = groupResults.find((r) => r.library === baselineLibrary);

    if (
      !solidis?.elapsedMs ||
      !baseline?.elapsedMs ||
      solidis.ratioVsBaseline === null
    ) {
      continue;
    }

    const { display, commands } = formatOperationName(
      solidis.operation,
      en.operationDisplayNames,
    );

    entries.push({
      name: display,
      description: commands,
      solidisMs: Math.round(solidis.elapsedMs),
      baselineMs: Math.round(baseline.elapsedMs),
      ratio: `${solidis.ratioVsBaseline.toFixed(1)}x`,
    });
  }

  entries.sort((a, b) => {
    const ratioA = Number.parseFloat(a.ratio);
    const ratioB = Number.parseFloat(b.ratio);
    return ratioB - ratioA;
  });

  return entries;
}

function generateBenchmarksPageData(entries: WebsiteBenchmarkEntry[]): string {
  const items = entries.map(
    (e) =>
      '    {\n' +
      `      name: '${e.name}',\n` +
      `      description: '${e.description}',\n` +
      `      solidis: '${e.solidisMs}ms',\n` +
      `      ioredis: '${e.baselineMs}ms',\n` +
      `      improvement: '${e.ratio}',\n` +
      `      solidisNumber: ${e.solidisMs},\n` +
      `      ioredisNumber: ${e.baselineMs},\n` +
      '    }',
  );

  return `  const benchmarkData = [\n${items.join(',\n')},\n  ];`;
}

function generateHomePageData(entries: WebsiteBenchmarkEntry[]): string {
  const items = entries.map(
    (e) =>
      '  {\n' +
      `    name: '${e.name}',\n` +
      `    commands: '${e.description}',\n` +
      `    solidis: ${e.solidisMs},\n` +
      `    ioredis: ${e.baselineMs},\n` +
      `    multiplier: '${e.ratio}',\n` +
      '  }',
  );

  return `const BENCHMARK_DATA = [\n${items.join(',\n')},\n];`;
}

const BENCHMARKS_DATA_PATTERN = / {2}const benchmarkData = \[[\s\S]*?\n {2}\];/;

const HOME_DATA_PATTERN = /const BENCHMARK_DATA = \[[\s\S]*?\n\];/;

const MAX_SPEED_BOOST_PATTERN =
  /(<div className="text-2xl font-bold text-amber-600 mb-1">)[\d.]+x(<\/div>)/;

const processArguments = process.argv.slice(2);

if (processArguments.length < 1) {
  console.error(
    'Usage: benchmark:replace:website <snapshot.benchmark> [snapshot2.benchmark ...]',
  );
  process.exit(1);
}

const snapshotPaths = processArguments;
const snapshots = await Promise.all(
  snapshotPaths.map((path) => loadSnapshot(path)),
);
const merged = mergeSnapshots(snapshots);
const entries = buildWebsiteEntries(merged.results, merged.baselineLibrary);

if (entries.length === 0) {
  console.error('No comparable benchmark entries found in snapshots.');
  process.exit(1);
}

const peakRatio = entries[0].ratio;
const totalComparable = entries.length;

const projectRoot = resolve('.');
let updatedCount = 0;

const benchmarksPagePath = resolve(
  projectRoot,
  'website',
  'app',
  'benchmarks',
  'page.tsx',
);

try {
  let content = await readFile(benchmarksPagePath, 'utf-8');
  let changed = false;

  const newData = generateBenchmarksPageData(entries);
  if (BENCHMARKS_DATA_PATTERN.test(content)) {
    content = content.replace(BENCHMARKS_DATA_PATTERN, newData);
    changed = true;
  }

  const boostMatch = MAX_SPEED_BOOST_PATTERN.exec(content);
  if (boostMatch) {
    content = content.replace(MAX_SPEED_BOOST_PATTERN, `$1${peakRatio}$2`);
    changed = true;
  }

  if (changed) {
    await writeFile(benchmarksPagePath, content, 'utf-8');
    updatedCount += 1;
    console.log('Updated: website/app/benchmarks/page.tsx');
  }
} catch {
  console.log('Skipped: website/app/benchmarks/page.tsx (not found)');
}

const homePagePath = resolve(projectRoot, 'website', 'app', 'page.tsx');
const HOME_PAGE_TOP_COUNT = 6;

try {
  let content = await readFile(homePagePath, 'utf-8');
  let changed = false;

  const topEntries = entries.slice(0, HOME_PAGE_TOP_COUNT);
  const newData = generateHomePageData(topEntries);
  if (HOME_DATA_PATTERN.test(content)) {
    content = content.replace(HOME_DATA_PATTERN, newData);
    changed = true;
  }

  if (changed) {
    await writeFile(homePagePath, content, 'utf-8');
    updatedCount += 1;
    console.log('Updated: website/app/page.tsx');
  }
} catch {
  console.log('Skipped: website/app/page.tsx (not found)');
}

const i18nDir = resolve(projectRoot, 'website', 'i18n', 'messages');

for (const locale of ['en', 'ko']) {
  const filePath = resolve(i18nDir, `${locale}.json`);

  try {
    const raw = await readFile(filePath, 'utf-8');
    const json = JSON.parse(raw);
    let changed = false;

    if (json.benchmarks?.benchmarkResultsDesc) {
      const currentDesc: string = json.benchmarks.benchmarkResultsDesc;
      const newDesc = currentDesc.replace(
        /\d+\s*\/\s*\d+/,
        `${totalComparable} / ${totalComparable}`,
      );

      if (newDesc !== currentDesc) {
        json.benchmarks.benchmarkResultsDesc = newDesc;
        changed = true;
      }
    }

    if (json.home?.twiceAsFastDesc) {
      const currentDesc: string = json.home.twiceAsFastDesc;
      const newDesc = currentDesc
        .replace(/[\d.]+x faster/i, `${peakRatio} faster`)
        .replace(/[\d.]+배 빠릅니다/i, `${peakRatio} 빠릅니다`)
        .replace(/\d+개 벤치마크/i, `${totalComparable}개 벤치마크`)
        .replace(
          /\d+ benchmark categories/i,
          `${totalComparable} benchmark categories`,
        );

      if (newDesc !== currentDesc) {
        json.home.twiceAsFastDesc = newDesc;
        changed = true;
      }
    }

    if (json.home?.benchmarkDesc) {
      const currentDesc: string = json.home.benchmarkDesc;
      const newDesc = currentDesc
        .replace(/[\d.]+x faster/i, `${peakRatio} faster`)
        .replace(/[\d.]+배 빠릅니다/i, `${peakRatio} 빠릅니다`)
        .replace(
          /\d+ benchmark categories/i,
          `${totalComparable} benchmark categories`,
        )
        .replace(/\d+개 벤치마크/i, `${totalComparable}개 벤치마크`);

      if (newDesc !== currentDesc) {
        json.home.benchmarkDesc = newDesc;
        changed = true;
      }
    }

    if (json.faq?.a5) {
      const currentA5: string = json.faq.a5;
      const peakFloor = `${Math.floor(Number.parseFloat(peakRatio))}`;
      const newA5 = currentA5
        .replace(/\d+x faster/i, `${peakFloor}x faster`)
        .replace(
          /\d+ different operation types/i,
          `${totalComparable} different operation types`,
        )
        .replace(/[\d.]+배 빠릅니다/i, `${peakFloor}배 빠릅니다`)
        .replace(/\d+개 카테고리/i, `${totalComparable}개 카테고리`);

      if (newA5 !== currentA5) {
        json.faq.a5 = newA5;
        changed = true;
      }
    }

    if (changed) {
      await writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf-8');
      updatedCount += 1;
      console.log(`Updated: website/i18n/messages/${locale}.json`);
    }
  } catch {
    console.log(`Skipped: website/i18n/messages/${locale}.json (not found)`);
  }
}

console.log(`\nDone: ${updatedCount} file(s) updated.`);
