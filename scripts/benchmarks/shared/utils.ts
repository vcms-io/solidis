import { isMainThread } from 'node:worker_threads';

export async function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function retry<T>(
  label: string,
  work: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      logWarn(`${label} failed (attempt ${attempt}/${attempts}): ${error}`);

      await sleep(250 * attempt);
    }
  }

  throw lastError;
}

export function unwrapScanReply(reply: unknown): [string, string[]] {
  if (!Array.isArray(reply) || reply.length !== 2) {
    throw new Error(`Unexpected SCAN reply: ${reply}`);
  }

  const [cursor, keys] = reply;

  if (!Array.isArray(keys)) {
    throw new Error(`Unexpected SCAN keys: ${keys}`);
  }

  return [
    Buffer.isBuffer(cursor) ? cursor.toString() : `${cursor}`,
    keys.map((key) => (Buffer.isBuffer(key) ? key.toString() : `${key}`)),
  ];
}

export const ansi = Object.freeze({
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
});

const DISPLAY_LINE_WIDTH = 70;

const threadIcon = isMainThread ? '●' : '◦';
const threadColor = isMainThread ? ansi.cyan : ansi.yellow;

function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

  return `${ansi.dim}${hours}:${minutes}:${seconds}.${milliseconds}${ansi.reset}`;
}

export function formatPayloadSize(bytes: number): string {
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${bytes} B`;
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(1);
}

const ESCAPE_CHARACTER = String.fromCharCode(27);

export const ANSI_ESCAPE_PATTERN = new RegExp(
  `${ESCAPE_CHARACTER}\\[[0-9;]*m`,
  'g',
);

export function stripAnsiEscapes(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}

export function logProgress(message: string): void {
  console.log(
    `  ${threadColor}${threadIcon}${ansi.reset} ${formatTimestamp()} ${message}`,
  );
}

export function logStep(label: string, details?: string): void {
  const suffix = details ? ` ${ansi.dim}${details}${ansi.reset}` : '';

  console.log(
    `  ${threadColor}${threadIcon}${ansi.reset} ${formatTimestamp()} ${ansi.bold}${label}${ansi.reset}${suffix}`,
  );
}

export function logWarn(message: string): void {
  console.log(
    `  ${ansi.yellow}⚠${ansi.reset} ${formatTimestamp()} ${ansi.yellow}${message}${ansi.reset}`,
  );
}

export function logError(message: string): void {
  console.log(
    `  ${ansi.red}✖${ansi.reset} ${formatTimestamp()} ${ansi.red}${message}${ansi.reset}`,
  );
}

export function logSuccess(message: string): void {
  console.log(
    `  ${ansi.green}✔${ansi.reset} ${formatTimestamp()} ${ansi.green}${message}${ansi.reset}`,
  );
}

export function logSeparator(): void {
  console.log(`${ansi.dim}${'─'.repeat(DISPLAY_LINE_WIDTH)}${ansi.reset}`);
}

export function logCaseTitle(caseName: string, payloadBytes: number): void {
  const title = caseName.toUpperCase();
  const subtitle = `payload ${formatPayloadSize(payloadBytes)}`;
  const line = '═'.repeat(DISPLAY_LINE_WIDTH);

  console.log('');
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);
  console.log(
    `${ansi.bold}${ansi.cyan}  ${title}${ansi.reset}  ${ansi.dim}│${ansi.reset}  ${ansi.white}${subtitle}${ansi.reset}`,
  );
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);
}

export function logSampleStart(
  caseName: string,
  library: string,
  sampleNumber: number,
  totalSamples: number,
): void {
  console.log(
    `  ${threadColor}${threadIcon}${ansi.reset} ${formatTimestamp()} ` +
      `${ansi.bold}▶ ${caseName}${ansi.reset} ` +
      `${ansi.dim}library=${ansi.reset}${ansi.magenta}${library}${ansi.reset} ` +
      `${ansi.dim}sample ${sampleNumber}/${totalSamples}${ansi.reset}`,
  );
}

export function logSampleDone(
  caseName: string,
  library: string,
  sampleNumber: number,
  totalSamples: number,
  elapsedMilliseconds: number,
  wallMilliseconds: number,
): void {
  console.log(
    `  ${threadColor}${threadIcon}${ansi.reset} ${formatTimestamp()} ` +
      `${ansi.green}✔ ${caseName}${ansi.reset} ` +
      `${ansi.dim}library=${ansi.reset}${ansi.magenta}${library}${ansi.reset} ` +
      `${ansi.dim}sample ${sampleNumber}/${totalSamples}${ansi.reset} ` +
      `${ansi.bold}${elapsedMilliseconds.toFixed(1)}ms${ansi.reset} ` +
      `${ansi.dim}(wall ${wallMilliseconds.toFixed(0)}ms)${ansi.reset}`,
  );
}

export function logCaseDone(
  caseName: string,
  payloadBytes: number,
  wallMilliseconds: number,
): void {
  console.log(
    `  ${ansi.cyan}■${ansi.reset} ${formatTimestamp()} ` +
      `${ansi.bold}${caseName}${ansi.reset} ` +
      `${ansi.dim}payload=${payloadBytes}${ansi.reset} ` +
      `completed in ${ansi.bold}${(wallMilliseconds / 1000).toFixed(1)}s${ansi.reset}`,
  );
}

export function logPhase(label: string, details?: string): void {
  const suffix = details ? ` ${ansi.dim}${details}${ansi.reset}` : '';

  console.log(
    `  ${threadColor}${threadIcon}${ansi.reset} ${formatTimestamp()} ` +
      `${ansi.dim}┊${ansi.reset} ${label}${suffix}`,
  );
}

export function jitterPercent(samples: number[]): number {
  if (samples.length < 2) {
    return 0;
  }

  const minimum = Math.min(...samples);
  const maximum = Math.max(...samples);
  const average =
    samples.reduce((total, sample) => total + sample, 0) / samples.length;

  if (average === 0) {
    return 0;
  }

  return ((maximum - minimum) / average) * 100;
}

export function median(samples: number[]): number {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function spreadPercent(samples: number[], center: number): number {
  if (samples.length < 2 || center === 0) {
    return 0;
  }

  const mean =
    samples.reduce((total, sample) => total + sample, 0) / samples.length;

  const variance =
    samples.reduce((total, sample) => total + (sample - mean) ** 2, 0) /
    samples.length;

  return (Math.sqrt(variance) / center) * 100;
}
