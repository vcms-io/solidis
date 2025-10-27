"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, Terminal, Code, Zap, Package, Layers } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

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
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  npm install @vcms-io/solidis
                </div>
              </TabsContent>
              <TabsContent value="yarn">
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  yarn add @vcms-io/solidis
                </div>
              </TabsContent>
              <TabsContent value="pnpm">
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  pnpm add @vcms-io/solidis
                </div>
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
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <div className="text-green-400">// Import the basic client and commands</div>
                  <div>import {"{ SolidisClient }"} from '@vcms-io/solidis';</div>
                  <div>import {"{ get }"} from '@vcms-io/solidis/command/get';</div>
                  <div>import {"{ set }"} from '@vcms-io/solidis/command/set';</div>
                  <div>import {"{ multi }"} from '@vcms-io/solidis/command/multi';</div>
                  <div className="mt-2">import type {"{ SolidisClientExtensions }"} from '@vcms-io/solidis';</div>
                  <div className="mt-4 text-green-400">// Define extensions with type safety</div>
                  <div>const extensions = {"{"}</div>
                  <div className="ml-2">get,</div>
                  <div className="ml-2">set,</div>
                  <div className="ml-2">multi</div>
                  <div>{"}"} satisfies SolidisClientExtensions;</div>
                  <div className="mt-4 text-green-400">// Initialize client with extensions</div>
                  <div>const client = new SolidisClient({"{"}</div>
                  <div className="ml-2">host: '127.0.0.1',</div>
                  <div className="ml-2">port: 6379</div>
                  <div>{"}"}).extend(extensions);</div>
                  <div className="mt-4 text-green-400">// Use commands</div>
                  <div>await client.set('key', 'value');</div>
                  <div>const value = await client.get('key');</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">2. {t("gettingStarted.featuredClient")}</h3>
                <p className="text-sm text-gray-600 mb-3">{t("gettingStarted.featuredClientDesc")}</p>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <div className="text-green-400">// Import the featured client</div>
                  <div>import {"{ SolidisFeaturedClient }"} from '@vcms-io/solidis/featured';</div>
                  <div className="mt-4 text-green-400">// All RESP commands are pre-loaded</div>
                  <div>const client = new SolidisFeaturedClient({"{"}</div>
                  <div className="ml-2">host: '127.0.0.1',</div>
                  <div className="ml-2">port: 6379</div>
                  <div>{"}"});</div>
                  <div className="mt-4 text-green-400">// Use any RESP command directly</div>
                  <div>await client.set('key', 'value');</div>
                  <div>await client.hset('hash', 'field', 'value');</div>
                  <div>await client.lpush('list', 'item-1', 'item-2');</div>
                </div>
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
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <div className="text-green-400">// Create client (with lazy connect)</div>
              <div>const client = new SolidisClient({"{"}</div>
              <div className="ml-2">uri: 'redis://127.0.0.1:6379',</div>
              <div className="ml-2">lazyConnect: true</div>
              <div>
                {"}"}).extend({"{ get, set }"});
              </div>
              <div className="mt-4 text-green-400">// Explicitly connect when needed</div>
              <div>await client.connect();</div>
              <div className="mt-4 text-green-400">// Handle connection events</div>
              <div>client.on('connect', () =&gt; console.log('Connected to server'));</div>
              <div>client.on('ready', () =&gt; console.log('Client is ready for commands'));</div>
              <div>client.on('error', (err) =&gt; console.error('Error occurred: ', err));</div>
              <div>client.on('end', () =&gt; console.log('Connection closed'));</div>
              <div className="mt-4 text-green-400">// Close connection when done</div>
              <div>client.quit();</div>
            </div>
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
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <div className="text-green-400">// Set a key</div>
              <div>await client.set('key', 'value');</div>
              <div className="mt-4 text-green-400">// Get a key</div>
              <div>const value = await client.get('key');</div>
              <div>console.log(value); // 'value'</div>
              <div className="mt-4 text-green-400">// Delete a key</div>
              <div>await client.del('key');</div>
            </div>
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
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <div className="text-green-400">// Start a transaction</div>
              <div>const transaction = client.multi();</div>
              <div className="mt-4 text-green-400">// Queue commands (no await needed)</div>
              <div>transaction.set('key', 'value');</div>
              <div>transaction.incr('counter');</div>
              <div>transaction.get('key');</div>
              <div className="mt-4 text-green-400">// Execute transaction</div>
              <div>const results = await transaction.exec();</div>
              <div>console.log(results); // [[ 'OK' ], [ 1 ], [ &lt;Buffer 76 61 6c 75 65&gt; ]]</div>
              <div className="mt-4 text-green-400">// Or discard a transaction if needed</div>
              <div>const transaction = client.multi();</div>
              <div>transaction.set('key', 'value');</div>
              <div>transaction.discard(); // Cancel transaction</div>
            </div>
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
