import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BUNDLE_DIRECTORY = resolve('.bundle');
const SNAPSHOT_PATH = resolve(BUNDLE_DIRECTORY, 'snapshot.json');

interface BundleResult {
  name: string;
  bundleBytes: number;
  sourceMapBytes: number;
}

const snapshotContent = await readFile(SNAPSHOT_PATH, 'utf-8');
const results: BundleResult[] = JSON.parse(snapshotContent);

const solidisResult = results.find((result) => result.name === 'solidis');

if (!solidisResult) {
  console.error('Solidis result not found in snapshot.');
  process.exit(1);
}

const bundleKilobytes = Math.ceil(solidisResult.bundleBytes / 1024);
const badgeLabel = `<${bundleKilobytes}KB`;
const displayLabel = `< ${bundleKilobytes}KB`;

const projectRoot = resolve('.');
let updatedCount = 0;

async function replaceInFile(
  filePath: string,
  replacements: Array<{ pattern: RegExp; replacement: string }>,
): Promise<boolean> {
  const content = await readFile(filePath, 'utf-8');
  let updated = content;

  for (const { pattern, replacement } of replacements) {
    updated = updated.replace(pattern, replacement);
  }

  if (updated !== content) {
    await writeFile(filePath, updated, 'utf-8');
    return true;
  }

  return false;
}

const readmeEntries = await readdir(projectRoot);
const readmeFiles = readmeEntries.filter(
  (entry) =>
    entry.toLowerCase().startsWith('readme') &&
    entry.toLowerCase().endsWith('.md'),
);

for (const readmeFile of readmeFiles) {
  const filePath = resolve(projectRoot, readmeFile);
  const changed = await replaceInFile(filePath, [
    {
      pattern: /badge\/bundle-<\d+KB/g,
      replacement: `badge/bundle-${badgeLabel}`,
    },
    {
      pattern: /badge\/min_bundle-<\d+KB/g,
      replacement: `badge/min_bundle-${badgeLabel}`,
    },
    {
      pattern: /(<strong>&lt; )\d+(KB<\/strong>)/g,
      replacement: `$1${bundleKilobytes}$2`,
    },
    {
      pattern: /(\*\*< )\d+(KB\*\*)/g,
      replacement: `$1${bundleKilobytes}$2`,
    },
    {
      pattern: /(\*\*&lt; )\d+(KB\*\*)/g,
      replacement: `$1${bundleKilobytes}$2`,
    },
  ]);

  if (changed) {
    updatedCount += 1;
    console.log(`Updated: ${readmeFile}`);
  }
}

const websiteFiles: Array<{
  path: string;
  replacements: Array<{ pattern: RegExp; replacement: string }>;
}> = [
  {
    path: 'website/app/benchmarks/page.tsx',
    replacements: [
      { pattern: /&lt;\d+KB/g, replacement: `&lt;${bundleKilobytes}KB` },
    ],
  },
  {
    path: 'website/app/page.tsx',
    replacements: [
      { pattern: /&lt; \d+ KB/g, replacement: `&lt; ${bundleKilobytes} KB` },
    ],
  },
  {
    path: 'website/i18n/messages/en.json',
    replacements: [
      {
        pattern: /Under \d+ KB min bundle/g,
        replacement: `Under ${bundleKilobytes} KB min bundle`,
      },
    ],
  },
  {
    path: 'website/i18n/messages/ko.json',
    replacements: [
      {
        pattern: /최소 번들 \d+ KB 미만/g,
        replacement: `최소 번들 ${bundleKilobytes} KB 미만`,
      },
    ],
  },
  {
    path: 'website/public/llms.txt',
    replacements: [
      { pattern: /< \d+KB/g, replacement: `< ${bundleKilobytes}KB` },
    ],
  },
];

for (const { path, replacements } of websiteFiles) {
  try {
    if (await replaceInFile(resolve(projectRoot, path), replacements)) {
      updatedCount += 1;
      console.log(`Updated: ${path}`);
    }
  } catch {
    console.log(`Skipped: ${path} (not found)`);
  }
}

await rm(BUNDLE_DIRECTORY, { recursive: true, force: true });

console.log(
  `\nDone: ${updatedCount} file(s) updated with bundle size ${displayLabel}.`,
);
