import { readFileSync, writeFileSync } from 'node:fs';

interface SummaryCategory {
  name: string;
  percentage: number;
  covered: number;
  total: number;
}

interface FileEntry {
  name: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncovered: string;
}

interface DirectoryGroup {
  name: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  files: FileEntry[];
}

const ROW_PATTERN =
  /^(\s*)(\S.*?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(.*?)\s*$/;

function parseSummary(raw: string): SummaryCategory[] {
  const lines = raw.split('\n');
  const startIndex = lines.findIndex((line) =>
    line.includes('======== Coverage summary ========'),
  );

  if (startIndex === -1) {
    return [];
  }

  const categories: SummaryCategory[] = [];

  for (const line of lines.slice(startIndex)) {
    const match = line.match(/^(\w+)\s*:\s*([\d.]+)%\s*\(\s*(\d+)\/(\d+)\s*\)/);

    if (match) {
      categories.push({
        name: match[1],
        percentage: Number(match[2]),
        covered: Number(match[3]),
        total: Number(match[4]),
      });
    }
  }

  return categories;
}

function parseDetailedTable(raw: string): DirectoryGroup[] {
  const lines = raw.split('\n');
  const groups: DirectoryGroup[] = [];
  let currentGroup: DirectoryGroup | null = null;

  for (const line of lines) {
    const match = line.match(ROW_PATTERN);

    if (!match) {
      continue;
    }

    const [
      ,
      indent,
      name,
      statements,
      branches,
      functions,
      linesValue,
      uncovered,
    ] = match;
    const depth = indent.length;

    if (name === 'All files' || name === 'File') {
      continue;
    }

    if (depth <= 1) {
      currentGroup = {
        name: name.trim(),
        statements: Number(statements),
        branches: Number(branches),
        functions: Number(functions),
        lines: Number(linesValue),
        files: [],
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.files.push({
        name: name.trim(),
        statements: Number(statements),
        branches: Number(branches),
        functions: Number(functions),
        lines: Number(linesValue),
        uncovered: uncovered.trim(),
      });
    }
  }

  return groups;
}

function statusIcon(percentage: number): string {
  if (percentage >= 90) {
    return '🟢';
  }

  if (percentage >= 70) {
    return '🟡';
  }

  return '🔴';
}

function progressBar(percentage: number): string {
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;

  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}

function formatPercentage(percentage: number): string {
  return percentage === 100
    ? '🟢 **100%**'
    : `${statusIcon(percentage)} ${percentage}%`;
}

function buildMarkdown(
  summary: SummaryCategory[],
  groups: DirectoryGroup[],
): string {
  const linesCategory = summary.find((category) => category.name === 'Lines');
  const overallPercentage = linesCategory?.percentage ?? 0;

  const sections: string[] = [
    `## ${statusIcon(overallPercentage)} Coverage Report`,
    '',
    `> **Overall: ${overallPercentage}%** \`${progressBar(overallPercentage)}\``,
    '',
    '| | Category | Coverage | Covered / Total |',
    '|---|----------|----------|-----------------|',
    ...summary.map(
      (category) =>
        `| ${statusIcon(category.percentage)} | ${category.name} | **${category.percentage}%** | ${category.covered} / ${category.total} |`,
    ),
  ];

  if (groups.length === 0) {
    return sections.join('\n');
  }

  sections.push('', '---', '');

  for (const group of groups) {
    const incompleteFiles = group.files.filter((file) => file.lines < 100);
    const icon = statusIcon(group.lines);
    const label =
      incompleteFiles.length === 0
        ? `${icon} ${group.name} — ${group.lines}% (all files 100%)`
        : `${icon} ${group.name} — ${group.lines}% (${incompleteFiles.length} file${incompleteFiles.length > 1 ? 's' : ''} below 100%)`;

    const rows = group.files.map(
      (file) =>
        `| ${file.name} | ${formatPercentage(file.statements)} | ${formatPercentage(file.branches)} | ${formatPercentage(file.functions)} | ${formatPercentage(file.lines)} | ${file.uncovered ? `\`${file.uncovered}\`` : ''} |`,
    );

    sections.push(
      `<details><summary>${label}</summary>`,
      '',
      '| File | Statements | Branch | Funcs | Lines | Uncovered |',
      '|------|------------|--------|-------|-------|-----------|',
      ...rows,
      '',
      '</details>',
      '',
    );
  }

  return sections.join('\n');
}

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('Usage: report.ts <coverage-output-file> <output-file>');
  process.exit(1);
}

const raw = readFileSync(inputPath, 'utf8');
const summary = parseSummary(raw);

if (summary.length === 0) {
  console.error('Could not parse coverage summary from output.');
  process.exit(1);
}

const groups = parseDetailedTable(raw);
const markdown = buildMarkdown(summary, groups);

writeFileSync(outputPath, markdown);

console.log(`Report written to ${outputPath}`);
