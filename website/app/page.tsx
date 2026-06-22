'use client';

import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { ArchitectureDiagram } from '@/components/architecture-diagram';
import { CodeBlock } from '@/components/code-block';
import { Button } from '@/components/ui/button';
import { useCountUp } from '@/hooks/use-count-up';
import { useGitHubStats } from '@/hooks/use-github-stats';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { useI18n } from '@/lib/i18n-context';

const BENCHMARK_DATA = [
  {
    name: 'Set Mutation',
    commands: 'SADD + SISMEMBER + SREM',
    solidis: 1610,
    ioredis: 3398,
    multiplier: '2.1x',
  },
  {
    name: 'List Mutation',
    commands: 'LPUSH + RPUSH + LPOP + RPOP + LLEN',
    solidis: 2475,
    ioredis: 4597,
    multiplier: '1.9x',
  },
  {
    name: 'Set',
    commands: 'SET (1 KB payload)',
    solidis: 754,
    ioredis: 1367,
    multiplier: '1.8x',
  },
  {
    name: 'Sorted Set',
    commands: 'ZADD + ZRANGE + ZREM',
    solidis: 1734,
    ioredis: 3182,
    multiplier: '1.8x',
  },
  {
    name: 'Set Read',
    commands: 'SADD + SISMEMBER + SMEMBERS',
    solidis: 1703,
    ioredis: 3142,
    multiplier: '1.8x',
  },
  {
    name: 'Expire',
    commands: 'SET + EXPIRE + TTL',
    solidis: 1522,
    ioredis: 2751,
    multiplier: '1.8x',
  },
];

function BenchmarkBar({
  data,
  index,
  animated,
}: {
  data: (typeof BENCHMARK_DATA)[number];
  index: number;
  animated: boolean;
}) {
  const solidisWidth = 100;
  const ioredisWidth = (data.solidis / data.ioredis) * 100;
  const solidisAnimDuration = data.solidis;
  const ioredisAnimDuration = data.ioredis;

  return (
    <div className="group">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-foreground">
            {data.name}
          </span>
          <span className="ml-2 text-xs text-muted-foreground font-mono">
            {data.commands}
          </span>
        </div>
        <span
          className="text-sm font-mono font-semibold text-amber-600 transition-opacity duration-500"
          style={{
            opacity: animated ? 1 : 0,
            transitionDelay: `${index * 100 + 400}ms`,
          }}
        >
          {data.multiplier}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-foreground w-14 shrink-0">
            solidis
          </span>
          <div className="flex-1 relative h-2 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              style={{
                width: animated ? `${solidisWidth}%` : '0%',
                transition: `width ${solidisAnimDuration}ms linear`,
                transitionDelay: `${index * 150}ms`,
              }}
            />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground w-16 text-right shrink-0">
            {data.solidis}ms
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-muted-foreground w-14 shrink-0">
            ioredis
          </span>
          <div className="flex-1 relative h-2 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/15"
              style={{
                width: animated ? `${ioredisWidth}%` : '0%',
                transition: `width ${ioredisAnimDuration}ms linear`,
                transitionDelay: `${index * 150}ms`,
              }}
            />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground w-16 text-right shrink-0">
            {data.ioredis}ms
          </span>
        </div>
      </div>
    </div>
  );
}

function RevealSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { reference, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px',
  });

  return (
    <div
      ref={reference}
      className={`reveal ${isIntersecting ? 'visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const { stats, loading } = useGitHubStats();
  const { t } = useI18n();

  const { reference: benchmarkReference, isIntersecting: benchmarkVisible } =
    useIntersectionObserver({
      threshold: 0.2,
      rootMargin: '0px 0px -40px 0px',
    });

  const starsCount = useCountUp({
    end: stats.stars,
    duration: 1500,
    enabled: !loading,
  });

  const featureList = [
    {
      title: t('home.serverlessReady'),
      description: t('home.serverlessReadyDesc'),
    },
    { title: t('home.twiceAsFast'), description: t('home.twiceAsFastDesc') },
    { title: t('home.battleTested'), description: t('home.battleTestedDesc') },
    {
      title: t('home.modernProtocol'),
      description: t('home.modernProtocolDesc'),
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="relative content-container text-center">
          <div
            className="hero-reveal inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-8 transition-colors hover:border-foreground/20"
            style={{ '--hero-delay': '0ms' } as React.CSSProperties}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {loading
              ? t('home.loading')
              : `${starsCount.toLocaleString()} ${t('home.starsOnGitHub')}`}
          </div>

          <h1
            className="hero-reveal text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight gradient-text leading-[1.1] mb-6 text-balance"
            style={{ '--hero-delay': '150ms' } as React.CSSProperties}
          >
            {t('home.title')}
          </h1>

          <p
            className="hero-reveal text-lg text-muted-foreground mx-auto leading-relaxed mb-4"
            style={{ '--hero-delay': '300ms' } as React.CSSProperties}
          >
            {t('home.subtitle')}
          </p>

          <div
            className="hero-reveal flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono mb-10"
            style={{ '--hero-delay': '450ms' } as React.CSSProperties}
          >
            <span>0 deps</span>
            <span className="text-foreground/15">·</span>
            <span>383 commands</span>
            <span className="text-foreground/15">·</span>
            <span>&lt; 29 KB</span>
            <span className="text-foreground/15">·</span>
            <span>98% coverage</span>
          </div>

          <div
            className="hero-reveal flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto"
            style={{ '--hero-delay': '600ms' } as React.CSSProperties}
          >
            <Button
              size="lg"
              className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90 font-medium h-10 px-6 text-sm rounded-lg transition-all hover:shadow-lg"
              asChild
            >
              <Link href="/getting-started">
                {t('home.getStarted')}
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-card h-10 px-6 text-sm rounded-lg transition-all"
              asChild
            >
              <Link
                href="https://github.com/vcms-io/solidis"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('home.viewOnGitHub')}
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="pb-16">
        <RevealSection className="content-container max-w-2xl">
          <div className="card-base overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">
                {t('home.terminal')}
              </span>
            </div>
            <div className="p-4">
              <CodeBlock
                code={'npm install @vcms-io/solidis'}
                language="bash"
              />
            </div>
          </div>
        </RevealSection>
      </section>

      {/* Code Example */}
      <section className="section-block border-t border-border">
        <div className="content-container">
          <RevealSection>
            <div className="section-header">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
                {t('home.getStartedMinutes')}
              </h2>
              <p className="text-muted-foreground mx-auto text-[15px]">
                {t('home.getStartedDesc')}
              </p>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-2 gap-4">
            <RevealSection delay={100}>
              <div className="card-base overflow-hidden flex flex-col h-full">
                <div className="flex items-center px-4 py-2.5 border-b border-border">
                  <span className="text-xs text-muted-foreground font-mono">
                    featured-client.ts
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col [&>div]:flex-1">
                  <CodeBlock
                    code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

const client = new SolidisFeaturedClient({
  host: '127.0.0.1',
  port: 6379,
});

await client.set('key', 'value');
const value = await client.get('key');`}
                    language="typescript"
                  />
                </div>
              </div>
            </RevealSection>

            <RevealSection delay={200}>
              <div className="card-base overflow-hidden flex flex-col h-full">
                <div className="flex items-center px-4 py-2.5 border-b border-border">
                  <span className="text-xs text-muted-foreground font-mono">
                    tree-shakable.ts
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col [&>div]:flex-1">
                  <CodeBlock
                    code={`import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';

const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379,
}).extend({ get, set });

await client.set('key', 'value');`}
                    language="typescript"
                  />
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-block border-t border-border">
        <div className="content-container">
          <RevealSection>
            <div className="section-header">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
                {t('home.whyChoose')}
              </h2>
              <p className="text-muted-foreground mx-auto text-[15px]">
                {t('home.whyDescription')}
              </p>
            </div>
          </RevealSection>

          <div className="grid sm:grid-cols-2 gap-4">
            {featureList.map((feature, index) => (
              <RevealSection key={feature.title} delay={index * 100}>
                <div className="card-base feature-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-1.5 transition-colors duration-250">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Benchmarks */}
      <section className="section-block border-t border-border">
        <div className="content-container">
          <RevealSection>
            <div className="section-header">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/20 bg-amber-500/5 px-3 py-1 text-xs font-medium text-amber-600 mb-4">
                {t('home.performance')}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
                {t('home.blazingFast')}
              </h2>
              <p className="text-muted-foreground mx-auto text-[15px]">
                {t('home.benchmarkDesc')}
              </p>
            </div>
          </RevealSection>

          <RevealSection delay={100}>
            <div ref={benchmarkReference} className="card-base p-6 space-y-5">
              {BENCHMARK_DATA.map((benchmark, index) => (
                <BenchmarkBar
                  key={benchmark.name}
                  data={benchmark}
                  index={index}
                  animated={benchmarkVisible}
                />
              ))}
            </div>
          </RevealSection>

          <RevealSection delay={200}>
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                size="sm"
                className="border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/30 h-9 text-[13px] transition-all"
                asChild
              >
                <Link href="/benchmarks">
                  {t('home.viewBenchmarks')}
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Architecture Preview */}
      <section className="section-block border-t border-border">
        <div className="content-container">
          <RevealSection>
            <div className="section-header">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
                {t('home.solidArchitecture')}
              </h2>
              <p className="text-muted-foreground mx-auto text-[15px]">
                {t('home.solidArchitectureDesc')}
              </p>
            </div>
          </RevealSection>

          <RevealSection delay={100}>
            <div className="card-base p-5 sm:p-8">
              <ArchitectureDiagram compact />
            </div>
          </RevealSection>

          <RevealSection delay={200}>
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                size="sm"
                className="border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/30 h-9 text-[13px] transition-all"
                asChild
              >
                <Link href="/architecture">
                  {t('home.viewArchitecture')}
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Documentation Links */}
      <section className="section-block border-t border-border">
        <div className="content-container">
          <RevealSection>
            <div className="section-header">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
                {t('home.comprehensiveDocs')}
              </h2>
              <p className="text-muted-foreground mx-auto text-[15px]">
                {t('home.comprehensiveDocsDesc')}
              </p>
            </div>
          </RevealSection>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: t('nav.gettingStarted'),
                description: t('home.gettingStartedCard'),
                href: '/getting-started',
              },
              {
                title: t('nav.apiReference'),
                description: t('home.apiReferenceCard'),
                href: '/api-reference',
              },
              {
                title: t('nav.tutorials'),
                description: t('home.tutorialsCard'),
                href: '/tutorials',
              },
            ].map((card, index) => (
              <RevealSection key={card.href} delay={index * 100}>
                <Link
                  href={card.href}
                  className="card-base card-interactive p-5 block h-full"
                >
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">
                    {card.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                    {card.description}
                  </p>
                  <span className="inline-flex items-center text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {t('home.learnMore')}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </span>
                </Link>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-block border-t border-border">
        <RevealSection className="content-container text-center">
          <h2 className="text-2xl font-bold tracking-tight gradient-text mb-4">
            {t('home.readyToStart')}
          </h2>
          <p className="text-muted-foreground mb-8 mx-auto text-[15px]">
            {t('home.readyToStartDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90 font-medium h-10 px-6 text-sm rounded-lg transition-all hover:shadow-lg"
              asChild
            >
              <Link href="/getting-started">
                {t('home.getStarted')}
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-card h-10 px-6 text-sm rounded-lg transition-all"
              asChild
            >
              <Link href="/api-reference">{t('home.viewApi')}</Link>
            </Button>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
