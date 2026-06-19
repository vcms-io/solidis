'use client';

import {
  CheckCircle,
  Code,
  Layers,
  Package,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import { CodeBlock } from '@/components/code-block';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n-context';

export default function GettingStartedPage() {
  const { t } = useI18n();

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('gettingStarted.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('gettingStarted.subtitle')}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-amber-500" />
              {t('gettingStarted.prerequisites')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Badge variant="outline">Node.js</Badge>
                <span className="text-sm text-muted-foreground">
                  {t('gettingStarted.nodeVersion')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">TypeScript</Badge>
                <span className="text-sm text-muted-foreground">
                  {t('gettingStarted.tsVersion')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">Redis</Badge>
                <span className="text-sm text-muted-foreground">
                  {t('gettingStarted.redisVersion')}
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-amber-500" />
              {t('gettingStarted.installation')}
            </CardTitle>
            <CardDescription>
              {t('gettingStarted.installationDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="npm" className="w-full">
              <TabsList>
                <TabsTrigger value="npm">npm</TabsTrigger>
                <TabsTrigger value="yarn">yarn</TabsTrigger>
                <TabsTrigger value="pnpm">pnpm</TabsTrigger>
              </TabsList>
              <TabsContent value="npm">
                <CodeBlock
                  code="npm install @vcms-io/solidis"
                  language="bash"
                />
              </TabsContent>
              <TabsContent value="yarn">
                <CodeBlock code="yarn add @vcms-io/solidis" language="bash" />
              </TabsContent>
              <TabsContent value="pnpm">
                <CodeBlock code="pnpm add @vcms-io/solidis" language="bash" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-amber-500" />
              {t('gettingStarted.clientTypes')}
            </CardTitle>
            <CardDescription>
              {t('gettingStarted.clientTypesDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  1. {t('gettingStarted.basicClient')}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('gettingStarted.basicClientDesc')}
                </p>
                <CodeBlock
                  code={`import { SolidisClient } from '@vcms-io/solidis';
import { get, set, multi } from '@vcms-io/solidis/command';
import type { SolidisClientExtensions } from '@vcms-io/solidis';

const extensions = {
  get,
  set,
  multi,
} satisfies SolidisClientExtensions;

const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379,
}).extend(extensions);`}
                  language="typescript"
                  showLineNumbers={true}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  2. {t('gettingStarted.featuredClient')}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('gettingStarted.featuredClientDesc')}
                </p>
                <CodeBlock
                  code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

const client = new SolidisFeaturedClient({
  host: '127.0.0.1',
  port: 6379,
});`}
                  language="typescript"
                  showLineNumbers={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-amber-500" />
              {t('gettingStarted.connectionManagement')}
            </CardTitle>
            <CardDescription>
              {t('gettingStarted.connectionManagementDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock
              code={`const client = new SolidisClient({
  uri: 'redis://127.0.0.1:6379',
  lazyConnect: true,
}).extend({ get, set });

await client.connect();

client.on('connect', () => console.log('Connected to server'));
client.on('ready', () => console.log('Client is ready for commands'));
client.on('error', (err) => console.error('Error occurred: ', err));
client.on('end', () => console.log('Connection closed'));

client.quit();`}
              language="typescript"
              showLineNumbers={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-amber-500" />
              {t('gettingStarted.basicOperations')}
            </CardTitle>
            <CardDescription>
              {t('gettingStarted.basicOperationsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock
              code={`await client.set('key', 'value');

const value = await client.get('key');
console.log(value); // 'value'

await client.del('key');`}
              language="typescript"
              showLineNumbers={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code className="h-4 w-4 text-amber-500" />
              {t('gettingStarted.transactions')}
            </CardTitle>
            <CardDescription>
              {t('gettingStarted.transactionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock
              code={`const transaction = client.multi();

transaction.set('key', 'value');
transaction.incr('counter');
transaction.get('key');

const results = await transaction.exec();`}
              language="typescript"
              showLineNumbers={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('gettingStarted.nextSteps')}
            </CardTitle>
            <CardDescription>
              {t('gettingStarted.nextStepsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Link
                href="/api-reference"
                className="group card-base card-interactive p-4 block"
              >
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {t('nav.apiReference')}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('gettingStarted.apiReferenceLink')}
                </p>
                <span className="text-xs text-amber-500">
                  {t('gettingStarted.viewApiReference')}
                </span>
              </Link>
              <Link
                href="/tutorials"
                className="group card-base card-interactive p-4 block"
              >
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {t('nav.tutorials')}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('gettingStarted.tutorialsLink')}
                </p>
                <span className="text-xs text-amber-500">
                  {t('gettingStarted.startLearning')}
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
