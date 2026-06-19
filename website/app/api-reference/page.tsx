'use client';

import {
  AlertTriangle,
  Book,
  Code,
  Layers,
  Settings,
  Terminal,
  Zap,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n-context';

export default function ApiReferencePage() {
  const { t } = useI18n();

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          {t('apiReference.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('apiReference.subtitle')}
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 lg:gap-8">
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t('apiReference.quickNavigation')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <nav className="space-y-1.5">
                {[
                  { href: '#solidisclient', label: 'SolidisClient' },
                  {
                    href: '#connection',
                    label: t('apiReference.connectionMethods'),
                    indent: true,
                  },
                  {
                    href: '#basic-operations',
                    label: t('apiReference.basicOperations'),
                    indent: true,
                  },
                  {
                    href: '#advanced-operations',
                    label: t('apiReference.advancedOperations'),
                    indent: true,
                  },
                  {
                    href: '#configuration',
                    label: t('apiReference.configuration'),
                  },
                  {
                    href: '#advanced-features',
                    label: t('apiReference.advancedFeatures'),
                  },
                  {
                    href: '#error-handling',
                    label: t('apiReference.errorHandling'),
                  },
                  { href: '#events', label: t('apiReference.events') },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`block text-xs text-muted-foreground hover:text-foreground transition-colors ${item.indent ? 'ml-3' : ''}`}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <section id="solidisclient">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code className="h-4 w-4 text-amber-500" />
                  SolidisClient
                </CardTitle>
                <CardDescription>
                  {t('apiReference.mainClassDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t('apiReference.constructor')}
                    </h3>
                    <CodeBlock
                      code={'new SolidisClient(options?: SolidisClientOptions)'}
                      language="typescript"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t('apiReference.parameters')}
                    </h3>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs">
                        options
                      </Badge>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          SolidisClientOptions
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('apiReference.optionalConfig')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="connection">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t('apiReference.connectionMethods')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="connect" className="w-full">
                  <TabsList>
                    <TabsTrigger value="connect">connect()</TabsTrigger>
                    <TabsTrigger value="quit">quit()</TabsTrigger>
                  </TabsList>
                  <TabsContent value="connect" className="space-y-3">
                    <div className="rounded-md bg-secondary/50 px-3 py-2 font-mono text-sm text-foreground">
                      <span className="text-blue-600">async</span> connect():
                      Promise{'<void>'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.connectDesc')}
                    </p>
                    <CodeBlock
                      code={`const client = new SolidisClient();
await client.connect();`}
                      language="typescript"
                    />
                  </TabsContent>
                  <TabsContent value="quit" className="space-y-3">
                    <div className="rounded-md bg-secondary/50 px-3 py-2 font-mono text-sm text-foreground">
                      quit(): void
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.disconnectDesc')}
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          <section id="basic-operations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Book className="h-4 w-4 text-amber-500" />
                  {t('apiReference.basicOperations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    {[
                      {
                        signature:
                          'async set(key: string, value: StringOrBuffer, options?: CommandSetOptions): Promise<StringOrBuffer | RespOK | null>',
                        descriptionKey: 'apiReference.setDesc',
                      },
                      {
                        signature:
                          'async get(key: string): Promise<string | null>',
                        descriptionKey: 'apiReference.getDesc',
                      },
                      {
                        signature:
                          'async del(...keys: string[]): Promise<number>',
                        descriptionKey: 'apiReference.delDesc',
                      },
                    ].map((method) => (
                      <div key={method.signature} className="card-base p-3">
                        <div className="font-mono text-xs text-foreground mb-1 overflow-x-auto">
                          {method.signature}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t(method.descriptionKey)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t('apiReference.example')}
                    </h3>
                    <CodeBlock
                      code={`await client.set('user:123', 'John Doe');

const user = await client.get('user:123');
console.log(user); // 'John Doe'

await client.del('user:123');`}
                      language="typescript"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="advanced-operations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-amber-500" />
                  {t('apiReference.advancedOperations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="transactions" className="w-full">
                  <TabsList>
                    <TabsTrigger value="transactions">
                      {t('apiReference.transactions')}
                    </TabsTrigger>
                    <TabsTrigger value="pipelines">
                      {t('apiReference.pipelines')}
                    </TabsTrigger>
                    <TabsTrigger value="pubsub">Pub/Sub</TabsTrigger>
                  </TabsList>
                  <TabsContent value="transactions" className="space-y-3">
                    <CodeBlock
                      code={`const transaction = client.multi();

transaction.set('key', 'value');
transaction.incr('counter');
transaction.get('key');

const results = await transaction.exec();
console.log(results); // ['OK', 1, <Buffer 'value'>]`}
                      language="typescript"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.transactionsDesc')}
                    </p>
                  </TabsContent>
                  <TabsContent value="pipelines" className="space-y-3">
                    <CodeBlock
                      code={`const commands = [
  ['SET', 'key', 'value'],
  ['INCR', 'counter'],
  ['GET', 'key']
];

const results = await client.send(commands);
console.log(results); // [['OK'], [1], [<Buffer>]]`}
                      language="typescript"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.pipelinesDesc')}
                    </p>
                  </TabsContent>
                  <TabsContent value="pubsub" className="space-y-3">
                    <CodeBlock
                      code={`client.on('message', (channel, message) => {
  console.log(\`Received \${message} from \${channel}\`);
});

client.on('smessage', (channel, message) => {
  console.log(\`Received \${message} from shard channel \${channel}\`);
});

await client.subscribe('news');`}
                      language="typescript"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.pubsubDesc')}
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          <section id="configuration">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4 text-amber-500" />
                  {t('apiReference.configOptions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  code={`const client = new SolidisClient({
  uri: 'redis://localhost:6379',
  host: '127.0.0.1',
  port: 6379,
  tls: { /* tls.ConnectionOptions */ },
  lazyConnect: false,
  authentication: {
    username: 'user',
    password: 'password',
  },
  database: 0,
  clientName: 'solidis',
  protocol: 'RESP2',
  autoReconnect: true,
  autoRecovery: {
    database: true,
    subscribe: true,
    ssubscribe: true,
    psubscribe: true,
  },
  enableReadyCheck: true,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,
  commandTimeout: 5000,
  connectionTimeout: 2000,
  socketWriteTimeout: 1000,
  readyCheckInterval: 100,
  maxCommandsPerPipeline: 300,
  maxEventListenersForClient: 10240,
  maxEventListenersForSocket: 10240,
  maxProcessRepliesPerChunk: 4096,
  maxSocketWriteSizePerOnce: 65536,
  rejectOnPartialPipelineError: false,
  parser: {
    buffer: {
      initial: 4194304,
      shiftThreshold: 2097152,
    },
  },
  debug: false,
  debugMaxEntries: 10240,
});`}
                  language="typescript"
                  showLineNumbers={true}
                />
              </CardContent>
            </Card>
          </section>

          <section id="advanced-features">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-4 w-4 text-amber-500" />
                  {t('apiReference.advancedFeatures')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="custom-commands" className="w-full">
                  <TabsList>
                    <TabsTrigger value="custom-commands">
                      {t('apiReference.customCommands')}
                    </TabsTrigger>
                    <TabsTrigger value="raw-commands">
                      {t('apiReference.rawCommands')}
                    </TabsTrigger>
                    <TabsTrigger value="debugging">
                      {t('apiReference.debugging')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="custom-commands" className="space-y-3">
                    <CodeBlock
                      code={`import { SolidisClient } from '@vcms-io/solidis';
import { get, set } from '@vcms-io/solidis/command';
import type { SolidisClientExtensions } from '@vcms-io/solidis';

const extensions = {
  get,
  set,
  fill: async function(this: typeof client, keys: string[], value: string) {
    return await Promise.all(keys.map((key) => this.set(key, value)));
  },
} satisfies SolidisClientExtensions;

const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379,
}).extend(extensions);

await client.fill(['key1', 'key2', 'key3'], 'value');`}
                      language="typescript"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.customCommandsDesc')}
                    </p>
                  </TabsContent>
                  <TabsContent value="raw-commands" className="space-y-3">
                    <CodeBlock
                      code={`const result = await client.send([['COMMAND', 'SOME', 'OPTIONS']]);`}
                      language="typescript"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.rawCommandsDesc')}
                    </p>
                  </TabsContent>
                  <TabsContent value="debugging" className="space-y-3">
                    <CodeBlock
                      code={`const client = new SolidisClient({
  debug: true,
});

client.on('debug', (entry) => {
  console.log(\`[\${entry.type}] \${entry.message}\`, entry.data);
});`}
                      language="typescript"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('apiReference.debuggingDesc')}
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          <section id="error-handling">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t('apiReference.errorHandling')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  code={`import {
  SolidisError,
  SolidisClientError,
  SolidisCommandError,
  SolidisConnectionError,
  SolidisParserError,
  SolidisPubSubError,
  SolidisRequesterError,
  unwrapSolidisError,
} from '@vcms-io/solidis';

try {
  await client.set('key', 'value');
} catch (error) {
  console.error(unwrapSolidisError(error));

  if (error instanceof SolidisConnectionError) {
    console.error('Connection error:', error.message);
  } else if (error instanceof SolidisParserError) {
    console.error('Parser error:', error.message);
  } else if (error instanceof SolidisCommandError) {
    console.error('Command error:', error.message);
  }
}`}
                  language="typescript"
                />
                <div className="mt-4 space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {t('apiReference.errorTypes')}
                  </h3>
                  {[
                    {
                      name: 'SolidisError',
                      descriptionKey: 'apiReference.errorBase',
                    },
                    {
                      name: 'SolidisClientError',
                      descriptionKey: 'apiReference.errorClient',
                    },
                    {
                      name: 'SolidisCommandError',
                      descriptionKey: 'apiReference.errorCommand',
                    },
                    {
                      name: 'SolidisConnectionError',
                      descriptionKey: 'apiReference.errorConnection',
                    },
                    {
                      name: 'SolidisParserError',
                      descriptionKey: 'apiReference.errorParser',
                    },
                    {
                      name: 'SolidisPubSubError',
                      descriptionKey: 'apiReference.errorPubsub',
                    },
                    {
                      name: 'SolidisRequesterError',
                      descriptionKey: 'apiReference.errorExecution',
                    },
                  ].map((errorType) => (
                    <div
                      key={errorType.name}
                      className="flex items-start gap-2"
                    >
                      <Badge variant="outline" className="text-xs shrink-0">
                        {errorType.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t(errorType.descriptionKey)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="events">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t('apiReference.events')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  code={`client.on('connect', () => console.log('Connected to server'));
client.on('ready', () => console.log('Client is ready'));
client.on('end', () => console.log('Connection closed'));
client.on('close', () => console.log('Connection closed'));
client.on('drain', () => console.log('Socket drain occurred'));
client.on('error', (err) => console.error('Error:', err));

client.on('message', (channel, message) => console.log(\`\${channel}: \${message}\`));
client.on('smessage', (channel, message) => console.log(\`\${channel}: \${message}\`));
client.on('pmessage', (pattern, channel, message) => console.log(\`\${pattern} \${channel}: \${message}\`));

client.on('debug', (entry) => console.log(\`[\${entry.type}] \${entry.message}\`));`}
                  language="typescript"
                />
                <div className="mt-4 space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {t('apiReference.eventTypes')}
                  </h3>
                  {[
                    {
                      name: 'connect',
                      descriptionKey: 'apiReference.eventConnect',
                    },
                    {
                      name: 'ready',
                      descriptionKey: 'apiReference.eventReady',
                    },
                    {
                      name: 'end',
                      descriptionKey: 'apiReference.eventClose',
                    },
                    {
                      name: 'error',
                      descriptionKey: 'apiReference.eventError',
                    },
                    {
                      name: 'message',
                      descriptionKey: 'apiReference.eventMessage',
                    },
                    {
                      name: 'smessage',
                      descriptionKey: 'apiReference.eventShardMessage',
                    },
                    {
                      name: 'debug',
                      descriptionKey: 'apiReference.eventDebug',
                    },
                  ].map((event) => (
                    <div key={event.name} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 font-mono"
                      >
                        {event.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t(event.descriptionKey)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
