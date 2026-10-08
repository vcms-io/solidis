import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { benchmarkClients, benchmarkSummary } from './benchmarks';

export function classNames(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatOperations(operationsPerSecond: number) {
  const thousands = Math.round(operationsPerSecond / 1_000);

  return thousands >= 1_000
    ? `${(operationsPerSecond / 1_000_000).toFixed(2)}M`
    : `${thousands}K`;
}

function listNames(names: string[], conjunction: string) {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')}${conjunction}${names.at(-1)}`
    : names.join('');
}

export function getBenchmarkClaims(locale: string) {
  const times = locale === 'ko' ? '배' : 'x';

  return {
    clients: listNames(
      benchmarkClients
        .map((client) => client.name)
        .filter((name) => name !== 'solidis'),
      locale === 'ko' ? ', ' : ' and ',
    ),
    wins: benchmarkSummary.wins,
    total: benchmarkSummary.total,
    peak: `${benchmarkSummary.peakLead.toFixed(1)}${times}`,
    average: `${benchmarkSummary.averageLead.toFixed(1)}${times}`,
    iterations: benchmarkSummary.iterations.toLocaleString('en-US'),
    concurrency: benchmarkSummary.concurrency.toLocaleString('en-US'),
    repeats: benchmarkSummary.repeats,
    payload: benchmarkSummary.payload,
    mode: benchmarkSummary.mode,
  };
}
