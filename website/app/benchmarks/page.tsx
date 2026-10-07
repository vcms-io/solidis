'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  benchmarkCases,
  benchmarkNotes,
  benchmarkSummary,
} from '@/lib/benchmarks';
import { useI18n } from '@/lib/i18n-context';
import { formatOperations, getBenchmarkClaims } from '@/lib/utils';

export default function BenchmarksPage() {
  const { t, locale } = useI18n();

  const claims = getBenchmarkClaims(locale);

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('benchmarks.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('benchmarks.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card-base p-5 text-center">
          <div className="text-2xl font-bold text-amber-600 mb-1">
            {benchmarkSummary.peakLead.toFixed(1)}x
          </div>
          <div className="text-xs text-muted-foreground">
            {t('benchmarks.maxSpeedBoost')}
          </div>
        </div>
        <div className="card-base p-5 text-center">
          <div className="text-2xl font-bold text-foreground mb-1">0</div>
          <div className="text-xs text-muted-foreground">
            {t('benchmarks.dependencies')}
          </div>
        </div>
        <div className="card-base p-5 text-center">
          <div className="text-2xl font-bold text-foreground mb-1">
            &lt;30KB
          </div>
          <div className="text-xs text-muted-foreground">
            {t('benchmarks.bundleSize')}
          </div>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">
            {t('benchmarks.methodology')}
          </CardTitle>
          <CardDescription>
            {t('benchmarks.methodologyDesc', claims)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Node.js</span>
              <span className="ml-2 font-mono text-foreground">
                {benchmarkSummary.nodeVersion}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t('benchmarks.server')}
              </span>
              <span className="ml-2 font-mono text-foreground">
                {benchmarkSummary.server}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t('benchmarks.platform')}
              </span>
              <span className="ml-2 font-mono text-foreground">
                {benchmarkSummary.platform}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">
            {t('benchmarks.benchmarkResults')}
          </CardTitle>
          <CardDescription>
            {t('benchmarks.benchmarkResultsDesc', claims)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {benchmarkCases.map((benchmark) => {
              const fastest = Math.max(
                ...benchmark.clients.map(
                  (client) => client.operationsPerSecond,
                ),
              );

              return (
                <div key={benchmark.name.en}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {benchmark.name[locale]}
                      </span>
                      <span className="block sm:inline sm:ml-2 text-xs text-muted-foreground font-mono">
                        {benchmark.commands}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30 text-xs w-fit"
                    >
                      {benchmark.lead.toFixed(1)}x
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {benchmark.clients.map((client) => (
                      <div
                        key={client.name}
                        className="flex items-center gap-3"
                      >
                        <span
                          className={`text-[11px] font-mono w-20 shrink-0 ${client.name === 'solidis' ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {client.name}
                          {client.note > 0 && <sup>{client.note}</sup>}
                        </span>
                        <div className="flex-1 relative h-2 rounded-full bg-secondary/50 overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${client.name === 'solidis' ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-foreground/15'}`}
                            style={{
                              width: `${(client.operationsPerSecond / fastest) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground w-20 text-right shrink-0">
                          {formatOperations(client.operationsPerSecond)} ops/s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 space-y-1 text-[11px] text-muted-foreground">
            {benchmarkNotes.map((note, index) => (
              <p key={note.en}>
                <sup>{index + 1}</sup> {note[locale]}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">
            {t('benchmarks.whyFaster')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                titleKey: 'zeroDeps',
                descriptionKey: 'zeroDepsDesc2',
              },
              {
                titleKey: 'binarySafeParser',
                descriptionKey: 'binarySafeParserDesc',
              },
              {
                titleKey: 'pipelineCoalescing',
                descriptionKey: 'pipelineCoalescingDesc',
              },
              {
                titleKey: 'coalescedWrites',
                descriptionKey: 'coalescedWritesDesc',
              },
            ].map((item) => (
              <div key={item.titleKey} className="card-base p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {t(`benchmarks.${item.titleKey}`)}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t(`benchmarks.${item.descriptionKey}`)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="card-base p-8 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t('benchmarks.readySpeed')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('benchmarks.readySpeedDesc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/getting-started"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-foreground text-background px-5 py-2 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            {t('benchmarks.getStarted')}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
          <Link
            href="https://github.com/vcms-io/solidis"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('benchmarks.viewOnGitHub')}
          </Link>
        </div>
      </div>
    </div>
  );
}
