'use client';

import {
  Calendar,
  Clock,
  ExternalLink,
  Tag,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useGitHubReleases } from '@/hooks/use-github-releases';
import { useI18n } from '@/lib/i18n-context';

export default function UpdatesPage() {
  const { t } = useI18n();
  const { releases, loading, error, fallback } = useGitHubReleases();

  const upcomingFeatures = [
    {
      titleKey: 'metrics',
      descriptionKey: 'metricsDesc',
      statusKey: 'statusPlanned',
    },
    {
      titleKey: 'advancedCaching',
      descriptionKey: 'advancedCachingDesc',
      statusKey: 'statusResearch',
    },
  ];

  const getStatusColor = (statusKey: string) => {
    switch (statusKey) {
      case 'statusInDev':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'statusPlanned':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'statusResearch':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const parseChangelog = (body: string) => {
    const lines = body.split('\n');
    const changes: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
        const change = line.trim().replace(/^[*-]\s*/, '');
        if (change && !change.startsWith('**Full Changelog**')) {
          changes.push(change);
        }
      }
    }

    return changes.slice(0, 5);
  };

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('updates.title')}
          </h1>
          {fallback && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              <span>{t('updates.cachedData')}</span>
            </div>
          )}
          {!fallback && !loading && (
            <div className="flex items-center gap-1 text-xs text-amber-500">
              <Wifi className="h-3 w-3" />
              <span>{t('updates.liveFromGitHub')}</span>
            </div>
          )}
        </div>
        <p className="text-lg text-muted-foreground">{t('updates.subtitle')}</p>
      </div>

      {releases.length > 0 && (
        <Card className="mb-8 border-emerald-500/20">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                {t('updates.latestRelease')}
              </CardTitle>
              <Badge
                variant="outline"
                className="text-emerald-600 border-emerald-500/30"
              >
                {releases[0].tag_name}
              </Badge>
            </div>
            <CardDescription>{t('updates.latestReleaseDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Released {formatDate(releases[0].published_at)}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                by {releases[0].author.login}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4 animate-spin" />
            {t('updates.loadingReleases')}
          </div>
        </div>
      )}

      <div className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {t('updates.releaseHistory')}
        </h2>
        <div className="space-y-4">
          {releases.map((release, index) => {
            const changes = parseChangelog(release.body);
            const isLatest = index === 0;

            return (
              <Card key={release.tag_name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-3.5 w-3.5 text-amber-500" />
                    <CardTitle className="text-sm font-mono">
                      {release.tag_name}
                    </CardTitle>
                    {isLatest && (
                      <Badge
                        variant="outline"
                        className="text-emerald-600 border-emerald-500/30 text-[10px]"
                      >
                        {t('updates.latestBadge')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(release.published_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {release.author.login}
                    </div>
                    <a
                      href={release.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-amber-500 hover:text-amber-600"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('updates.viewOnGitHubLink')}
                    </a>
                  </div>
                </CardHeader>
                <CardContent>
                  {changes.length > 0 && (
                    <ul className="space-y-1">
                      {changes.map((change, changeIndex) => (
                        <li
                          key={changeIndex}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <span className="text-emerald-600 mt-0.5">·</span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  )}
                  {changes.length === 0 && release.body && (
                    <div className="prose prose-sm prose-neutral max-w-none text-xs text-muted-foreground">
                      <ReactMarkdown>{`${release.body.slice(0, 300)}...`}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {error && fallback && (
        <Card className="mb-8 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-amber-500">
              <WifiOff className="h-3 w-3" />
              {t('updates.cachedWarning')}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {t('updates.upcomingFeatures')}
        </h2>
        <div className="space-y-3">
          {upcomingFeatures.map((feature) => (
            <Card key={feature.titleKey}>
              <CardHeader className="pb-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-sm">
                      {t(`updates.${feature.titleKey}`)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t(`updates.${feature.descriptionKey}`)}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(feature.statusKey)}>
                    {t(`updates.${feature.statusKey}`)}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('updates.stayUpdated')}
          </CardTitle>
          <CardDescription>{t('updates.stayUpdatedDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            <a
              href="https://github.com/vcms-io/solidis/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t('updates.githubReleases')}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                {t('updates.githubReleasesDesc')}
              </p>
              <span className="text-xs text-amber-500">
                {t('updates.viewOnGitHub')}
              </span>
            </a>
            <a
              href="https://www.npmjs.com/package/@vcms-io/solidis"
              target="_blank"
              rel="noopener noreferrer"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t('updates.npmUpdates')}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                {t('updates.npmUpdatesDesc')}
              </p>
              <span className="text-xs text-amber-500">
                {t('updates.viewOnNpm')}
              </span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
