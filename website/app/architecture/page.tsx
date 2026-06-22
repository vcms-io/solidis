'use client';

import {
  ArrowRight,
  Code,
  Database,
  Layers,
  Network,
  Shield,
  Zap,
} from 'lucide-react';

import { ArchitectureDiagram } from '@/components/architecture-diagram';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/lib/i18n-context';

export default function ArchitecturePage() {
  const { t } = useI18n();

  const components = [
    {
      name: 'SolidisClient',
      icon: <Code className="h-5 w-5 text-amber-500" />,
      description: t('architecture.coreDesc'),
      responsibilities: [
        t('architecture.coreInit'),
        t('architecture.coreConfig'),
        t('architecture.coreEvent'),
        t('architecture.coreExtension'),
      ],
    },
    {
      name: 'Connection',
      icon: <Network className="h-5 w-5 text-blue-600" />,
      description: t('architecture.connectionDesc'),
      responsibilities: [
        t('architecture.connSocket'),
        t('architecture.connReconnect'),
        t('architecture.connTls'),
        t('architecture.connState'),
        t('architecture.connRecovery'),
      ],
    },
    {
      name: 'Requester',
      icon: <Zap className="h-5 w-5 text-emerald-600" />,
      description: t('architecture.requesterDesc'),
      responsibilities: [
        t('architecture.reqQueue'),
        t('architecture.reqPipeline'),
        t('architecture.reqCorrelation'),
        t('architecture.reqTimeout'),
        t('architecture.reqTransaction'),
      ],
    },
    {
      name: 'Parser',
      icon: <Database className="h-5 w-5 text-purple-600" />,
      description: t('architecture.parserDesc'),
      responsibilities: [
        t('architecture.parserParsing'),
        t('architecture.parserOwnedBuffers'),
        t('architecture.parserMemory'),
        t('architecture.parserMultibyte'),
        t('architecture.parserBinary'),
      ],
    },
    {
      name: 'PubSub',
      icon: <Shield className="h-5 w-5 text-red-500" />,
      description: t('architecture.pubsubDesc'),
      responsibilities: [
        t('architecture.pubsubChannel'),
        t('architecture.pubsubPattern'),
        t('architecture.pubsubRouting'),
        t('architecture.pubsubRecovery'),
      ],
    },
    {
      name: 'Debug Memory',
      icon: <Layers className="h-5 w-5 text-muted-foreground" />,
      description: t('architecture.debugDesc'),
      responsibilities: [
        t('architecture.debugEvent'),
        t('architecture.debugBuffer'),
        t('architecture.debugFilter'),
        t('architecture.debugMetrics'),
      ],
    },
  ];

  const principles = [
    {
      letter: 'S',
      title: t('architecture.srp'),
      description: t('architecture.srpDesc'),
      example: t('architecture.srpExample'),
    },
    {
      letter: 'O',
      title: t('architecture.ocp'),
      description: t('architecture.ocpDesc'),
      example: t('architecture.ocpExample'),
    },
    {
      letter: 'L',
      title: t('architecture.lsp'),
      description: t('architecture.lspDesc'),
      example: t('architecture.lspExample'),
    },
    {
      letter: 'I',
      title: t('architecture.isp'),
      description: t('architecture.ispDesc'),
      example: t('architecture.ispExample'),
    },
    {
      letter: 'D',
      title: t('architecture.dip'),
      description: t('architecture.dipDesc'),
      example: t('architecture.dipExample'),
    },
  ];

  const executionSteps = [
    {
      step: 1,
      title: t('architecture.flow1'),
      description: t('architecture.flow1Desc'),
    },
    {
      step: 2,
      title: t('architecture.flow2'),
      description: t('architecture.flow2Desc'),
    },
    {
      step: 3,
      title: t('architecture.flow3'),
      description: t('architecture.flow3Desc'),
    },
    {
      step: 4,
      title: t('architecture.flow4'),
      description: t('architecture.flow4Desc'),
    },
    {
      step: 5,
      title: t('architecture.flow5'),
      description: t('architecture.flow5Desc'),
    },
    {
      step: 6,
      title: t('architecture.flow6'),
      description: t('architecture.flow6Desc'),
    },
  ];

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('architecture.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('architecture.subtitle')}
        </p>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="text-base">
            {t('architecture.systemArchitecture')}
          </CardTitle>
          <CardDescription>
            {t('architecture.systemArchitectureDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArchitectureDiagram />
        </CardContent>
      </Card>

      <div className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {t('architecture.coreComponents')}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {components.map((component) => (
            <Card
              key={component.name}
              className="transition-all hover:border-foreground/20"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-1">
                  {component.icon}
                  <CardTitle className="text-sm">{component.name}</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {component.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {component.responsibilities.map((responsibility) => (
                    <li
                      key={responsibility}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="text-amber-500 mt-0.5">·</span>
                      <span className="text-muted-foreground">
                        {responsibility}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {t('architecture.solidPrinciples')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('architecture.solidDesc')}
        </p>
        <div className="space-y-3">
          {principles.map((principle) => (
            <Card key={principle.letter}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-amber-500 border-amber-500/30"
                  >
                    {principle.letter}
                  </Badge>
                  {principle.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  {principle.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-secondary/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t('architecture.example')}
                    </span>
                    {principle.example}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="h-4 w-4 text-amber-500" />
            {t('architecture.commandFlow')}
          </CardTitle>
          <CardDescription>{t('architecture.commandFlowDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {executionSteps.map((item) => (
              <div key={item.step} className="flex items-start gap-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-500" />
            {t('architecture.performanceOptimizations')}
          </CardTitle>
          <CardDescription>{t('architecture.perfDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: t('architecture.binarySafeParser'),
                description: t('architecture.binarySafeParserDesc'),
              },
              {
                title: t('architecture.pipelineBatching'),
                description: t('architecture.pipelineBatchingDesc'),
              },
              {
                title: t('architecture.bufferMgmt'),
                description: t('architecture.bufferMgmtDesc'),
              },
              {
                title: t('architecture.lazyConn'),
                description: t('architecture.lazyConnDesc'),
              },
            ].map((item, index) => (
              <div key={index}>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
