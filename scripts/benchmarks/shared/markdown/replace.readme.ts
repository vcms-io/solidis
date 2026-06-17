import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { deserializeConfig } from '../configuration.ts';
import { generateMarkdownReport } from './index.ts';
import { resolveLocale } from './locales/index.ts';
import { loadSnapshot, mergeSnapshots } from './snapshot.ts';

const MARKER = '<div id="benchmark">';
const DIV_OPEN = /<div[\s>]/gi;
const DIV_CLOSE = /<\/div>/gi;

function findClosingDiv(content: string, afterIndex: number): number {
  let depth = 1;
  let position = afterIndex;

  while (depth > 0 && position < content.length) {
    DIV_OPEN.lastIndex = position;
    DIV_CLOSE.lastIndex = position;

    const openMatch = DIV_OPEN.exec(content);
    const closeMatch = DIV_CLOSE.exec(content);

    if (!closeMatch) {
      return -1;
    }

    if (openMatch && openMatch.index < closeMatch.index) {
      depth += 1;
      position = openMatch.index + openMatch[0].length;
    } else {
      depth -= 1;

      if (depth === 0) {
        return closeMatch.index;
      }

      position = closeMatch.index + closeMatch[0].length;
    }
  }

  return -1;
}

const processArguments = process.argv.slice(2);

if (processArguments.length < 1) {
  console.error(
    'Usage: benchmark:replace:readme <snapshot.benchmark> [snapshot2.benchmark ...]',
  );
  process.exit(1);
}

const snapshotPaths = processArguments;
const snapshots = await Promise.all(
  snapshotPaths.map((path) => loadSnapshot(path)),
);
const merged = mergeSnapshots(snapshots);
const configuration = deserializeConfig(merged.configuration);

const projectRoot = resolve('.');
const entries = await readdir(projectRoot);
const readmeFiles = entries.filter(
  (entry) =>
    entry.toLowerCase().startsWith('readme') &&
    entry.toLowerCase().endsWith('.md'),
);

if (readmeFiles.length === 0) {
  console.error('No README*.md files found in project root.');
  process.exit(1);
}

let updatedCount = 0;

for (const readmeFile of readmeFiles) {
  const readmePath = resolve(projectRoot, readmeFile);
  const readme = await readFile(readmePath, 'utf-8');

  const startIndex = readme.indexOf(MARKER);

  if (startIndex === -1) {
    console.log(`Skipped ${readmeFile} (no benchmark marker)`);
    continue;
  }

  const contentStart = startIndex + MARKER.length;
  const closingIndex = findClosingDiv(readme, contentStart);

  if (closingIndex === -1) {
    console.error(`No matching </div> found in ${readmeFile}`);
    continue;
  }

  const locale = resolveLocale(readmeFile);
  const report = generateMarkdownReport(
    merged.results,
    merged.baselineLibrary,
    configuration,
    locale,
  );

  const section = `${MARKER}\n\n${locale.sectionTitle}\n\n${report.trimEnd()}\n\n</div>`;

  const updated =
    readme.slice(0, startIndex) +
    section +
    readme.slice(closingIndex + '</div>'.length);

  await writeFile(readmePath, updated, 'utf-8');
  updatedCount += 1;

  const langCode =
    readmeFile.match(/\.([a-z]{2}(?:-[a-z]{2})?)\.md$/i)?.[1] ?? 'en';
  console.log(`Updated ${readmeFile} (locale: ${langCode})`);
}

console.log(`Done: ${updatedCount} file(s) updated.`);
