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
      icon: <HelpCircle className="h-5 w-5 text-yellow-600" />,
      questions: [
        {
          question:
            'What is Solidis and how is it different from other Redis clients?',
          answer:
            "Solidis is a high-performance RESP client built with SOLID principles in mind. It offers better type safety and follows clean architecture patterns compared to traditional Redis clients. It's designed for modern TypeScript applications with a focus on maintainability and performance.",
        },
        {
          question: 'Which Redis versions are supported?',
          answer:
            'Solidis supports any RESP-compatible server, including Redis 5.0 and above, as well as cloud Redis services like AWS ElastiCache and Azure Cache for Redis.',
        },
        {
          question: 'Can I use Solidis in production?',
          answer:
            'Yes! Solidis is production-ready and includes features like automatic reconnection with configurable retry attempts and delays, comprehensive error handling, and pipeline optimization to ensure reliability in production deployments.',
        },
      ],
    },
    {
      title: t('faq.performanceCat'),
      icon: <Zap className="h-5 w-5 text-yellow-600" />,
      questions: [
        {
          question: 'How does Solidis handle command pipelining?',
          answer:
            'Solidis automatically batches commands into pipelines to reduce network round trips. You can configure the maximum number of commands per pipeline via the maxCommandsPerPipeline option (default: 300). This significantly improves throughput when executing multiple Redis operations.',
        },
        {
          question: "What's the performance compared to other Redis clients?",
          answer:
            'Solidis is optimized for high throughput and low latency. Benchmarks show it performs up to 79% faster than ioredis in hash operations, with the added benefits of better TypeScript support and cleaner architecture.',
        },
        {
          question: 'Does Solidis support transactions?',
          answer:
            'Yes, Solidis supports Redis transactions via the MULTI/EXEC pattern. Use client.multi() to start a transaction, queue commands, then call exec() to execute them atomically.',
        },
      ],
    },
    {
      title: t('faq.configurationCat'),
      icon: <Code className="h-5 w-5 text-yellow-600" />,
      questions: [
        {
          question: 'How do I configure connection timeouts?',
          answer:
            'You can configure both connection and command timeouts when creating a SolidisClient instance. Use the connectionTimeout option (default: 2000ms) for connection establishment timeout and commandTimeout (default: 5000ms) for individual command execution timeout.',
        },
        {
          question: 'How do I handle authentication?',
          answer:
            'Set the authentication option in your SolidisClient configuration with username and password fields. For Redis 6+ with ACL users, you can specify both the username and password.',
        },
        {
          question: 'What protocol versions are supported?',
          answer:
            'Solidis supports both RESP2 (default) and RESP3 protocols. You can configure the protocol version via the protocol option when creating a SolidisClient instance.',
        },
      ],
    },
    {
      title: t('faq.troubleshootingCat'),
      icon: <Shield className="h-5 w-5 text-red-600" />,
      questions: [
        {
          question: 'How do I handle connection errors?',
          answer:
            'Solidis provides comprehensive error handling with specific error types like SolidisConnectionError, SolidisClientError, and SolidisRequesterError. The client supports automatic reconnection with configurable retry attempts (maxConnectionRetries, default: 20) and delays (connectionRetryDelay, default: 100ms).',
        },
        {
          question: 'Why am I getting timeout errors?',
          answer:
            'Timeout errors can occur due to network issues, Redis server overload, or misconfigured timeout values. Check your connectionTimeout (default: 2000ms) and commandTimeout (default: 5000ms) settings, and ensure your Redis server is responsive.',
        },
        {
          question: 'How do I debug connection issues?',
          answer:
            "Enable debug logging by setting debug: true in your SolidisClient configuration. Listen for debug events via client.on('debug', (entry) => console.log(entry)) to get detailed logging for connection events, command execution, and errors.",
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">{t('faq.title')}</h1>
        <p className="text-xl text-gray-600">
          {t('faq.subtitle')}
          <a
            href="https://github.com/vcms-io/solidis/discussions"
            className="text-yellow-600 hover:underline ml-1"
          >
            {t('faq.askOnGitHub')}
          </a>
        </p>
      </div>

      <div className="space-y-8">
        {categories.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
                    <AccordionTrigger className="text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-12">
        <CardHeader>
          <CardTitle>{t('faq.stillNeedHelp')}</CardTitle>
          <CardDescription>{t('faq.stillNeedHelpDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">{t('faq.githubIssues')}</h3>
              <p className="text-sm text-gray-600 mb-3">
                {t('faq.githubIssuesDesc')}
              </p>
              <Badge variant="outline">{t('faq.bugReports')}</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">
                {t('faq.githubDiscussions')}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {t('faq.githubDiscussionsDesc')}
              </p>
              <Badge variant="outline">{t('faq.communitySupport')}</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">{t('faq.documentation')}</h3>
              <p className="text-sm text-gray-600 mb-3">
                {t('faq.documentationDesc')}
              </p>
              <Badge variant="outline">{t('faq.selfService')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
