'use client';

import { ArrowRight, Clock } from 'lucide-react';
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

export default function TutorialsPage() {
  const { t } = useI18n();

  const tutorials = [
    {
      title: t('tutorials.sessionStore'),
      description: t('tutorials.sessionStoreDesc'),
      difficulty: t('tutorials.beginner'),
      duration: '15 min',
      tags: ['sessions', 'web', 'authentication'],
      href: '/tutorials/session-store',
    },
    {
      title: t('tutorials.cacheLayer'),
      description: t('tutorials.cacheLayerDesc'),
      difficulty: t('tutorials.intermediate'),
      duration: '25 min',
      tags: ['caching', 'performance', 'database'],
      href: '/tutorials/cache-layer',
    },
    {
      title: t('tutorials.chatApp'),
      description: t('tutorials.chatAppDesc'),
      difficulty: t('tutorials.advanced'),
      duration: '45 min',
      tags: ['pubsub', 'realtime', 'websockets'],
      href: '/tutorials/chat-app',
    },
    {
      title: t('tutorials.rateLimiting'),
      description: t('tutorials.rateLimitingDesc'),
      difficulty: t('tutorials.intermediate'),
      duration: '20 min',
      tags: ['rate-limiting', 'api', 'security'],
      href: '/tutorials/rate-limiting',
    },
    {
      title: t('tutorials.distributedLocking'),
      description: t('tutorials.distributedLockingDesc'),
      difficulty: t('tutorials.advanced'),
      duration: '30 min',
      tags: ['locking', 'distributed', 'concurrency'],
      href: '/tutorials/distributed-locking',
    },
    {
      title: t('tutorials.jobQueue'),
      description: t('tutorials.jobQueueDesc'),
      difficulty: t('tutorials.intermediate'),
      duration: '35 min',
      tags: ['queues', 'jobs', 'background'],
      href: '/tutorials/job-queue',
    },
  ];

  const getDifficultyColor = (difficulty: string) => {
    const beginner = t('tutorials.beginner');
    const intermediate = t('tutorials.intermediate');
    const advanced = t('tutorials.advanced');

    if (difficulty === beginner) {
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    }
    if (difficulty === intermediate) {
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    }
    if (difficulty === advanced) {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    return '';
  };

  const learningSteps = [
    {
      step: 1,
      title: t('tutorials.step1'),
      description: t('tutorials.step1Desc'),
    },
    {
      step: 2,
      title: t('tutorials.step2'),
      description: t('tutorials.step2Desc'),
    },
    {
      step: 3,
      title: t('tutorials.step3'),
      description: t('tutorials.step3Desc'),
    },
    {
      step: 4,
      title: t('tutorials.step4'),
      description: t('tutorials.step4Desc'),
    },
  ];

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('tutorials.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('tutorials.subtitle')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {tutorials.map((tutorial) => (
          <Link
            key={tutorial.href}
            href={tutorial.href}
            className="group card-base card-interactive p-5 block"
          >
            <div className="flex items-center justify-between mb-3">
              <Badge className={getDifficultyColor(tutorial.difficulty)}>
                {tutorial.difficulty}
              </Badge>
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {tutorial.duration}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1.5 group-hover:text-amber-500 transition-colors">
              {tutorial.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {tutorial.description}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tutorial.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <span className="inline-flex items-center text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              {t('tutorials.startTutorial')}
              <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('tutorials.learningPath')}
          </CardTitle>
          <CardDescription>{t('tutorials.learningPathDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {learningSteps.map((item) => (
              <div
                key={item.step}
                className="flex items-center gap-4 card-base p-4"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-500">
                  {item.step}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
