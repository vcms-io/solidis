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
import { useI18n } from '@/lib/i18n-context';

export default function BenchmarksPage() {
  const { t } = useI18n();

  const benchmarkData = [
    {
      name: 'Set Mutation',
      description: 'SADD + SISMEMBER + SREM',
      solidis: '1651ms',
      ioredis: '3396ms',
      improvement: '2.1x',
      solidisNumber: 1651,
      ioredisNumber: 3396,
    },
    {
      name: 'Multi-Key',
      description: 'MSET + MGET',
      solidis: '1623ms',
      ioredis: '3045ms',
      improvement: '1.9x',
      solidisNumber: 1623,
      ioredisNumber: 3045,
    },
    {
      name: 'List Range',
      description: 'LPUSH + RPUSH + LRANGE',
      solidis: '1860ms',
      ioredis: '3623ms',
      improvement: '1.9x',
      solidisNumber: 1860,
      ioredisNumber: 3623,
    },
    {
      name: 'List Mutation',
      description: 'LPUSH + RPUSH + LPOP + RPOP + LLEN',
      solidis: '2615ms',
      ioredis: '4844ms',
      improvement: '1.9x',
      solidisNumber: 2615,
      ioredisNumber: 4844,
    },
    {
      name: 'Set',
      description: 'SET (1 KB payload)',
      solidis: '754ms',
      ioredis: '1352ms',
      improvement: '1.8x',
      solidisNumber: 754,
      ioredisNumber: 1352,
    },
    {
      name: 'Hash Mutation',
      description: 'HMSET + HMGET + HDEL',
      solidis: '1933ms',
      ioredis: '3414ms',
      improvement: '1.8x',
      solidisNumber: 1933,
      ioredisNumber: 3414,
    },
    {
      name: 'Set Read',
      description: 'SADD + SISMEMBER + SMEMBERS',
      solidis: '1842ms',
      ioredis: '3267ms',
      improvement: '1.8x',
      solidisNumber: 1842,
      ioredisNumber: 3267,
    },
    {
      name: 'Sorted Set',
      description: 'ZADD + ZRANGE + ZREM',
      solidis: '1559ms',
      ioredis: '2673ms',
      improvement: '1.7x',
      solidisNumber: 1559,
      ioredisNumber: 2673,
    },
    {
      name: 'Expire',
      description: 'SET + EXPIRE + TTL',
      solidis: '1478ms',
      ioredis: '2530ms',
      improvement: '1.7x',
      solidisNumber: 1478,
      ioredisNumber: 2530,
    },
    {
      name: 'Non-Transaction',
      description: 'SETPX + GET',
      solidis: '1227ms',
      ioredis: '2051ms',
      improvement: '1.7x',
      solidisNumber: 1227,
      ioredisNumber: 2051,
    },
    {
      name: 'Stream',
      description: 'XADD + XRANGE + XLEN',
      solidis: '1986ms',
      ioredis: '3216ms',
      improvement: '1.6x',
      solidisNumber: 1986,
      ioredisNumber: 3216,
    },
    {
      name: 'Get Buffer',
      description: 'GETBUFFER (1 KB payload)',
      solidis: '649ms',
      ioredis: '960ms',
      improvement: '1.5x',
      solidisNumber: 649,
      ioredisNumber: 960,
    },
    {
      name: 'Counter',
      description: 'INCR + DECR',
      solidis: '988ms',
      ioredis: '1481ms',
      improvement: '1.5x',
      solidisNumber: 988,
      ioredisNumber: 1481,
    },
    {
      name: 'Pipeline Mixed',
      description: 'SET + INCR + GET',
      solidis: '1710ms',
      ioredis: '2562ms',
      improvement: '1.5x',
      solidisNumber: 1710,
      ioredisNumber: 2562,
    },
    {
      name: 'Hash Round-Trip',
      description: 'HSET + HGET + HGETALL',
      solidis: '1829ms',
      ioredis: '2749ms',
      improvement: '1.5x',
      solidisNumber: 1829,
      ioredisNumber: 2749,
    },
  ];

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
          <div className="text-2xl font-bold text-amber-600 mb-1">2.1x</div>
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
            &lt;29KB
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
          <CardDescription>{t('benchmarks.methodologyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Node.js</span>
              <span className="ml-2 font-mono text-foreground">v22.22.3</span>
            </div>
            <div>
              <span className="text-muted-foreground">Redis</span>
              <span className="ml-2 font-mono text-foreground">7.0+</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t('benchmarks.platform')}
              </span>
              <span className="ml-2 font-mono text-foreground">Linux x64</span>
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
            {t('benchmarks.benchmarkResultsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {benchmarkData.map((benchmark) => {
              const solidisWidth = 100;
              const ioredisWidth =
                (benchmark.solidisNumber / benchmark.ioredisNumber) * 100;
              return (
                <div key={benchmark.name}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {benchmark.name}
                      </span>
                      <span className="block sm:inline sm:ml-2 text-xs text-muted-foreground font-mono">
                        {benchmark.description}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30 text-xs w-fit"
                    >
                      {benchmark.improvement}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-foreground w-14 shrink-0">
                        solidis
                      </span>
                      <div className="flex-1 relative h-2 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                          style={{ width: `${solidisWidth}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground w-16 text-right shrink-0">
                        {benchmark.solidis}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-muted-foreground w-14 shrink-0">
                        ioredis
                      </span>
                      <div className="flex-1 relative h-2 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-foreground/15"
                          style={{ width: `${ioredisWidth}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground w-16 text-right shrink-0">
                        {benchmark.ioredis}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
                titleKey: 'zeroCopyParser',
                descriptionKey: 'zeroCopyParserDesc',
              },
              {
                titleKey: 'pipelineCoalescing',
                descriptionKey: 'pipelineCoalescingDesc',
              },
              {
                titleKey: 'chunkedWrites',
                descriptionKey: 'chunkedWritesDesc',
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
