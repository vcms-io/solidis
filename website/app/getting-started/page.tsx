"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, Terminal, Code, Zap, Package, Layers } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { CodeBlock } from '@/components/code-block'

export default function GettingStartedPage() {
  const { t } = useI18n()

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{t("gettingStarted.title")}</h1>
        <p className="text-xl text-gray-600">
          {t("gettingStarted.subtitle")}
        </p>
      </div>

      <div className="space-y-8">
        {/* Prerequisites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-yellow-600" />
              {t("gettingStarted.prerequisites")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Badge variant="outline">Node.js</Badge>
                <span>Version 14.0 or higher (Node.js 22 LTS recommended)</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">TypeScript</Badge>
                <span>Version 4.5 or higher (optional but recommended)</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">Redis</Badge>
                <span>Any RESP-compatible server</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Installation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-yellow-600" />
              {t("gettingStarted.installation")}
            </CardTitle>
            <CardDescription>{t("gettingStarted.installationDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="npm" className="w-full">
              <TabsList>
                <TabsTrigger value="npm">npm</TabsTrigger>
                <TabsTrigger value="yarn">yarn</TabsTrigger>
                <TabsTrigger value="pnpm">pnpm</TabsTrigger>
              </TabsList>
              <TabsContent value="npm">
                <CodeBlock code="npm install @vcms-io/solidis" language="bash" />
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

        {/* Client Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-yellow-600" />
              {t("gettingStarted.clientTypes")}
            </CardTitle>
            <CardDescription>{t("gettingStarted.clientTypesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">1. {t("gettingStarted.basicClient")}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {t("gettingStarted.basicClientDesc")}
                </p>
                <CodeBlock code={`// Import the basic client and commands
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';
import { multi } from '@vcms-io/solidis/command/multi';
import type { SolidisClientExtensions } from '@vcms-io/solidis';

// Define extensions with type safety
const extensions = {
  get,
  set,
  multi
} satisfies SolidisClientExtensions;

// Initialize client with extensions
const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);`} language="typescript" showLineNumbers={true} />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">2. {t("gettingStarted.featuredClient")}</h3>
                <p className="text-sm text-gray-600 mb-3">{t("gettingStarted.featuredClientDesc")}</p>
                <CodeBlock code={`// Import the featured client
import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

// All RESP commands are pre-loaded
const client = new SolidisFeaturedClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);`} language="typescript" showLineNumbers={true} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-yellow-600" />
              {t("gettingStarted.connectionManagement")}
            </CardTitle>
            <CardDescription>{t("gettingStarted.connectionManagementDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`// Create client (with lazy connect)
const client = new SolidisClient({
  uri: 'redis://127.0.0.1:6379',
  lazyConnect: true
}).extend({ get, set });

// Explicitly connect when needed
await client.connect();

// Handle connection events
client.on('connect', () => console.log('Connected to server'));
client.on('ready', () => console.log('Client is ready for commands'));
client.on('error', (err) => console.error('Error occurred: ', err));
client.on('end', () => console.log('Connection closed'));

// Close connection when done
client.quit();`} language="typescript" showLineNumbers={true} />
          </CardContent>
        </Card>

        {/* Basic Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              {t("gettingStarted.basicOperations")}
            </CardTitle>
            <CardDescription>{t("gettingStarted.basicOperationsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`// Set a key
await client.set('key', 'value');

// Get a key
const value = await client.get('key');

console.log(value); // 'value'

// Delete a key
await client.del('key');`} language="typescript" showLineNumbers={true} />
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-yellow-600" />
              {t("gettingStarted.transactions")}
            </CardTitle>
            <CardDescription>{t("gettingStarted.transactionsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
              <CodeBlock code={`// Start a transaction
const transaction = client.multi();

// Queue commands (no await needed)
transaction.set('key', 'value');
transaction.incr('counter');
transaction.get('key');`} language="typescript" showLineNumbers={true} />
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>{t("gettingStarted.nextSteps")}</CardTitle>
            <CardDescription>{t("gettingStarted.nextStepsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">📚 {t("nav.apiReference")}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {t("gettingStarted.apiReferenceLink")}
                </p>
                <a href="/api-reference" className="text-yellow-600 hover:underline text-sm">
                  {t("gettingStarted.viewApiReference")}
                </a>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">🎯 {t("nav.tutorials")}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {t("gettingStarted.tutorialsLink")}
                </p>
                <a href="/tutorials" className="text-yellow-600 hover:underline text-sm">
                  {t("gettingStarted.startLearning")}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
