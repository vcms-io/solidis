'use client';

import {
  AlertCircle,
  Code,
  FileText,
  GitBranch,
  Star,
  TestTube,
  Users,
} from 'lucide-react';

import { CodeBlock } from '@/components/code-block';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/lib/i18n-context';

export default function ContributingPage() {
  const { t } = useI18n();

  const contributionTypes = [
    {
      icon: <Code className="h-5 w-5 text-blue-600" />,
      title: t('contributing.codeContributions'),
      description: t('contributing.codeContributionsDesc'),
      examples: [
        t('contributing.bugFixes'),
        t('contributing.newFeatures'),
        t('contributing.perfOptimizations'),
        t('contributing.refactoring'),
      ],
    },
    {
      icon: <FileText className="h-5 w-5 text-emerald-600" />,
      title: t('contributing.documentationCont'),
      description: t('contributing.documentationContDesc'),
      examples: [
        t('contributing.apiDocs'),
        t('contributing.tutorials'),
        t('contributing.codeExamples'),
        t('contributing.translations'),
      ],
    },
    {
      icon: <TestTube className="h-5 w-5 text-purple-600" />,
      title: t('contributing.testing'),
      description: t('contributing.testingDesc'),
      examples: [
        t('contributing.unitTests'),
        t('contributing.integrationTests'),
        t('contributing.perfTests'),
        t('contributing.edgeCases'),
      ],
    },
    {
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      title: t('contributing.bugReportsTitle'),
      description: t('contributing.bugReportsDesc'),
      examples: [
        t('contributing.bugReportsItem'),
        t('contributing.featureRequests'),
        t('contributing.perfIssues'),
        t('contributing.securityConcerns'),
      ],
    },
  ];

  const workflowSteps = [
    {
      step: 1,
      title: t('contributing.step1Title'),
      description: t('contributing.step1Desc'),
      code: 'git checkout -b feature/your-feature-name',
    },
    {
      step: 2,
      title: t('contributing.step2Title'),
      description: t('contributing.step2Desc'),
    },
    {
      step: 3,
      title: t('contributing.step3Title'),
      description: t('contributing.step3Desc'),
      code: 'npm test',
    },
    {
      step: 4,
      title: t('contributing.step4Title'),
      description: t('contributing.step4Desc'),
      code: 'git add .\ngit commit -m "feat: add new feature"',
    },
    {
      step: 5,
      title: t('contributing.step5Title'),
      description: t('contributing.step5Desc'),
      code: 'git push origin feature/your-feature-name',
    },
  ];

  const codeQualitySections = [
    {
      color: 'border-amber-500/50',
      title: t('contributing.tsBestPractices'),
      items: [
        t('contributing.tsRule1'),
        t('contributing.tsRule2'),
        t('contributing.tsRule3'),
      ],
    },
    {
      color: 'border-blue-500/50',
      title: t('contributing.perfConsiderations'),
      items: [
        t('contributing.perfRule1'),
        t('contributing.perfRule2'),
        t('contributing.perfRule3'),
      ],
    },
    {
      color: 'border-emerald-500/50',
      title: t('contributing.depsTitle'),
      items: [
        t('contributing.depsRule1'),
        t('contributing.depsRule2'),
        t('contributing.depsRule3'),
      ],
    },
    {
      color: 'border-purple-500/50',
      title: t('contributing.testTitle'),
      items: [
        t('contributing.testRule1'),
        t('contributing.testRule2'),
        t('contributing.testRule3'),
      ],
    },
  ];

  const communityLinks = [
    {
      title: t('contributing.ghIssues'),
      description: t('contributing.ghIssuesDesc'),
      href: 'https://github.com/vcms-io/solidis/issues',
    },
    {
      title: t('contributing.ghDiscussions'),
      description: t('contributing.ghDiscussionsDesc'),
      href: 'https://github.com/vcms-io/solidis/discussions',
    },
    {
      title: t('contributing.ghPullRequests'),
      description: t('contributing.ghPullRequestsDesc'),
      href: 'https://github.com/vcms-io/solidis/pulls',
    },
  ];

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('contributing.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('contributing.subtitle')}
        </p>
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {t('contributing.waysToContribute')}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {contributionTypes.map((type, index) => (
            <Card
              key={index}
              className="transition-all hover:border-foreground/20"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-1">
                  {type.icon}
                  <CardTitle className="text-sm">{type.title}</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {type.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {type.examples.map((example, exampleIndex) => (
                    <Badge
                      key={exampleIndex}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {example}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-amber-500" />
            {t('contributing.developmentSetup')}
          </CardTitle>
          <CardDescription>
            {t('contributing.developmentSetupDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {t('contributing.forkClone')}
              </h3>
              <CodeBlock
                code={`# Fork the repository on GitHub first
git clone https://github.com/YOUR_USERNAME/solidis.git
cd solidis`}
                language="bash"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {t('contributing.installDeps')}
              </h3>
              <CodeBlock code="npm install" language="bash" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {t('contributing.buildProject')}
              </h3>
              <CodeBlock code="npm run build" language="bash" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {t('contributing.runTests')}
              </h3>
              <CodeBlock code="npm test" language="bash" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="h-4 w-4 text-amber-500" />
            {t('contributing.workflowTitle')}
          </CardTitle>
          <CardDescription>{t('contributing.workflowGuide')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflowSteps.map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-500">
                  {item.step}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1">
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {item.description}
                  </div>
                  {item.code && <CodeBlock code={item.code} language="bash" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-amber-500" />
            {t('contributing.codeQuality')}
          </CardTitle>
          <CardDescription>{t('contributing.codeQualityDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {codeQualitySections.map((section, index) => (
              <div key={index} className={`border-l-2 ${section.color} pl-4`}>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  {section.title}
                </h4>
                <ul className="space-y-1">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="text-muted-foreground mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-amber-500" />
            {t('contributing.prGuidelines')}
          </CardTitle>
          <CardDescription>
            {t('contributing.prGuidelinesDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">
                {t('contributing.commitMessages')}
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                {t('contributing.commitFormat')}
              </p>
              <CodeBlock
                code={`feat: add new feature
fix: resolve bug in parser
docs: update API reference
test: add integration tests
perf: improve connection pooling`}
                language="bash"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('contributing.joinCommunity')}
          </CardTitle>
          <CardDescription>
            {t('contributing.joinCommunityDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {communityLinks.map((item, index) => (
              <a
                key={index}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="card-base card-interactive p-4 block"
              >
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
