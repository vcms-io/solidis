import { readFileSync, writeFileSync } from 'node:fs';

const BADGE_PATTERN = /badge\/coverage-[\d.]+%25-\w+/g;

function badgeColor(percentage: number): string {
  if (percentage >= 95) {
    return 'brightgreen';
  }

  if (percentage >= 90) {
    return 'green';
  }

  if (percentage >= 80) {
    return 'yellowgreen';
  }

  if (percentage >= 70) {
    return 'yellow';
  }

  return 'red';
}

const [inputPath, ...filePaths] = process.argv.slice(2);

if (!inputPath || filePaths.length === 0) {
  console.error('Usage: badge.ts <coverage-output-file> <file>...');
  process.exit(1);
}

const match = readFileSync(inputPath, 'utf8').match(
  /Coverage summary[\s\S]*?Lines\s*:\s*([\d.]+)%/,
);

if (!match) {
  console.error('Could not parse line coverage from output.');
  process.exit(1);
}

const percentage = Math.round(Number(match[1]));
const badge = `badge/coverage-${percentage}%25-${badgeColor(percentage)}`;

for (const filePath of filePaths) {
  const content = readFileSync(filePath, 'utf8');

  if (content.search(BADGE_PATTERN) === -1) {
    console.error(`No coverage badge found in ${filePath}`);
    process.exit(1);
  }

  const updatedContent = content.replace(BADGE_PATTERN, badge);

  if (updatedContent === content) {
    console.log(`${filePath}: coverage badge already shows ${percentage}%`);
  } else {
    writeFileSync(filePath, updatedContent);
    console.log(`${filePath}: coverage badge updated to ${percentage}%`);
  }
}
