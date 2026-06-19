'use client';

import { Code, HelpCircle, Shield, Zap } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/lib/i18n-context';

export default function FaqPage() {
  const { t } = useI18n();

  const categories = [
    {
      title: t('faq.gettingStartedCat'),
      icon: <HelpCircle className="h-4 w-4 text-amber-500" />,
      questions: [
        {
          question: t('faq.q1'),
          answer: t('faq.a1'),
        },
        {
          question: t('faq.q2'),
          answer: t('faq.a2'),
        },
        {
          question: t('faq.q3'),
          answer: t('faq.a3'),
        },
      ],
    },
    {
      title: t('faq.performanceCat'),
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      questions: [
        {
          question: t('faq.q4'),
          answer: t('faq.a4'),
        },
        {
          question: t('faq.q5'),
          answer: t('faq.a5'),
        },
        {
          question: t('faq.q6'),
          answer: t('faq.a6'),
        },
      ],
    },
    {
      title: t('faq.configurationCat'),
      icon: <Code className="h-4 w-4 text-amber-500" />,
      questions: [
        {
          question: t('faq.q7'),
          answer: t('faq.a7'),
        },
        {
          question: t('faq.q8'),
          answer: t('faq.a8'),
        },
        {
          question: t('faq.q9'),
          answer: t('faq.a9'),
        },
      ],
    },
    {
      title: t('faq.troubleshootingCat'),
      icon: <Shield className="h-4 w-4 text-red-500" />,
      questions: [
        {
          question: t('faq.q10'),
          answer: t('faq.a10'),
        },
        {
          question: t('faq.q11'),
          answer: t('faq.a11'),
        },
        {
          question: t('faq.q12'),
          answer: t('faq.a12'),
        },
      ],
    },
  ];

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('faq.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('faq.subtitle')}{' '}
          <a
            href="https://github.com/vcms-io/solidis/discussions"
            className="text-amber-500 hover:underline"
          >
            {t('faq.askOnGitHub')}
          </a>
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {category.icon}
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {category.questions.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${categoryIndex}-${index}`}
                  >
                    <AccordionTrigger className="text-left text-sm">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle className="text-base">{t('faq.stillNeedHelp')}</CardTitle>
          <CardDescription>{t('faq.stillNeedHelpDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            <a
              href="https://github.com/vcms-io/solidis/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="card-base card-interactive p-4 text-center block"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t('faq.githubIssues')}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                {t('faq.githubIssuesDesc')}
              </p>
              <Badge variant="outline" className="text-[10px]">
                {t('faq.bugReports')}
              </Badge>
            </a>
            <a
              href="https://github.com/vcms-io/solidis/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="card-base card-interactive p-4 text-center block"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t('faq.githubDiscussions')}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                {t('faq.githubDiscussionsDesc')}
              </p>
              <Badge variant="outline" className="text-[10px]">
                {t('faq.communitySupport')}
              </Badge>
            </a>
            <a
              href="/getting-started"
              className="card-base card-interactive p-4 text-center block"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t('faq.documentation')}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                {t('faq.documentationDesc')}
              </p>
              <Badge variant="outline" className="text-[10px]">
                {t('faq.selfService')}
              </Badge>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
