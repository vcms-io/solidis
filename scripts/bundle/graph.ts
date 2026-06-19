import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createCanvas } from '@napi-rs/canvas';

const SNAPSHOT_PATH = resolve('.bundle', 'snapshot.json');
const OUTPUT_PATH = resolve('assets', 'bundle.png');

interface BundleResult {
  name: string;
  bundleBytes: number;
  sourceMapBytes: number;
}

const COLORS = {
  title: '#1a1a2e',
  subtitle: '#64748b',
  label: '#334155',
  value: '#0f172a',
  axis: '#94a3b8',
  gridLine: '#e2e8f0',
  solidis: { bundle: '#f59e0b', map: '#fbbf24' },
  ioredis: { bundle: '#ef4444', map: '#f87171' },
  nodeRedis: { bundle: '#8b5cf6', map: '#a78bfa' },
} as const;

const DISPLAY_NAMES: Record<string, string> = {
  solidis: 'solidis',
  ioredis: 'ioredis',
  'node-redis': 'redis',
};

type ColorPair = { bundle: string; map: string };

const BAR_COLORS: Record<string, ColorPair> = {
  solidis: COLORS.solidis,
  ioredis: COLORS.ioredis,
  'node-redis': COLORS.nodeRedis,
};

function formatKilobytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

function drawRoundedTop(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x, y + height);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height);
  context.closePath();
}

type CanvasRenderingContext2D = ReturnType<
  ReturnType<typeof createCanvas>['getContext']
>;

const snapshotContent = await readFile(SNAPSHOT_PATH, 'utf-8');
const results: BundleResult[] = JSON.parse(snapshotContent);

const canvasWidth = 1580;
const canvasHeight = 980;
const canvas = createCanvas(canvasWidth, canvasHeight);
const context = canvas.getContext('2d');

context.clearRect(0, 0, canvasWidth, canvasHeight);

const margin = { top: 120, right: 100, bottom: 80, left: 120 };
const chartLeft = margin.left;
const chartRight = canvasWidth - margin.right;
const chartTop = margin.top;
const chartBottom = canvasHeight - margin.bottom;
const chartWidth = chartRight - chartLeft;
const chartHeight = chartBottom - chartTop;

context.fillStyle = COLORS.title;
context.font = 'bold 44px "Segoe UI", -apple-system, sans-serif';
context.textAlign = 'center';
context.textBaseline = 'top';
context.fillText('Bundle Size Comparison', canvasWidth / 2, 32);

const allBytes = results.flatMap((r) => [r.bundleBytes, r.sourceMapBytes]);
const maximumBytes = Math.max(...allBytes);
const ceilingKilobytes = Math.ceil(((maximumBytes / 1024) * 1) / 100) * 100;
const scaleMaximum = ceilingKilobytes * 1024;

const gridCount = 5;

for (let step = 0; step <= gridCount; step++) {
  const ratio = step / gridCount;
  const y = chartBottom - chartHeight * ratio;
  const kilobyteValue = Math.round((scaleMaximum * ratio) / 1024);

  context.setLineDash([6, 4]);
  context.strokeStyle = COLORS.gridLine;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(chartLeft, y);
  context.lineTo(chartRight, y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = COLORS.label;
  context.font = '20px "Segoe UI", -apple-system, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.fillText(`${kilobyteValue}`, chartLeft - 16, y);
}

context.strokeStyle = COLORS.axis;
context.lineWidth = 2;
context.beginPath();
context.moveTo(chartLeft, chartTop);
context.lineTo(chartLeft, chartBottom);
context.stroke();

context.beginPath();
context.moveTo(chartLeft, chartBottom);
context.lineTo(chartRight, chartBottom);
context.stroke();

context.fillStyle = COLORS.subtitle;
context.font = '20px "Segoe UI", -apple-system, sans-serif';
context.textAlign = 'center';
context.textBaseline = 'middle';
context.save();
context.translate(36, chartTop + chartHeight / 2);
context.rotate(-Math.PI / 2);
context.fillText('Size (KB)', 0, 0);
context.restore();

const libraryCount = results.length;
const groupWidth = chartWidth / libraryCount;
const groupPadding = groupWidth * 0.08;
const barWidth = (groupWidth - groupPadding * 2) / 2;
const barRadius = 6;

for (let i = 1; i < libraryCount; i++) {
  const x = chartLeft + groupWidth * i;
  context.setLineDash([6, 4]);
  context.strokeStyle = COLORS.gridLine;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, chartTop);
  context.lineTo(x, chartBottom);
  context.stroke();
  context.setLineDash([]);
}

for (let index = 0; index < results.length; index++) {
  const result = results[index];
  const groupCenter = chartLeft + groupWidth * index + groupWidth / 2;
  const colors = BAR_COLORS[result.name] ?? COLORS.solidis;

  const bundleHeight = (result.bundleBytes / scaleMaximum) * chartHeight;
  const mapHeight = (result.sourceMapBytes / scaleMaximum) * chartHeight;

  const bundleX = groupCenter - barWidth;
  const bundleY = chartBottom - bundleHeight;

  drawRoundedTop(context, bundleX, bundleY, barWidth, bundleHeight, barRadius);
  context.fillStyle = colors.bundle;
  context.fill();

  const mapX = groupCenter;
  const mapY = chartBottom - mapHeight;

  drawRoundedTop(context, mapX, mapY, barWidth, mapHeight, barRadius);
  context.fillStyle = colors.map;
  context.fill();

  context.fillStyle = COLORS.value;
  context.font = 'bold 22px "Segoe UI", -apple-system, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.fillText(
    formatKilobytes(result.bundleBytes),
    bundleX + barWidth / 2,
    bundleY - 28,
  );
  context.fillText(
    formatKilobytes(result.sourceMapBytes),
    mapX + barWidth / 2,
    mapY - 24,
  );

  context.fillStyle = COLORS.subtitle;
  context.font = '15px "Segoe UI", -apple-system, sans-serif';
  context.textBaseline = 'bottom';
  context.fillText('.mjs', bundleX + barWidth / 2, bundleY - 6);
  context.fillText('.map', mapX + barWidth / 2, mapY - 6);

  context.fillStyle = COLORS.label;
  context.font = '24px "Segoe UI", -apple-system, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillText(
    DISPLAY_NAMES[result.name] ?? result.name,
    groupCenter,
    chartBottom + 20,
  );
}

const buffer = canvas.toBuffer('image/png');
await writeFile(OUTPUT_PATH, buffer);

console.log(`Bundle graph saved to: ${OUTPUT_PATH}`);
