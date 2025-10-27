"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Code, Book, Zap, Settings, Layers, Terminal, AlertTriangle } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

export default function ApiReferencePage() {
  const { t } = useI18n()

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{t("apiReference.title")}</h1>
        <p className="text-xl text-gray-600">
          {t("apiReference.subtitle")}
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <nav className="space-y-2">
                <a href="#solidisclient" className="block text-sm hover:text-yellow-600">
                  SolidisClient
                </a>
                <a href="#connection" className="block text-sm hover:text-yellow-600 ml-4">
                  Connection
                </a>
                <a href="#basic-operations" className="block text-sm hover:text-yellow-600 ml-4">
                  Basic Operations
                </a>
                <a href="#advanced-operations" className="block text-sm hover:text-yellow-600 ml-4">
                  Advanced Operations
                </a>
                <a href="#configuration" className="block text-sm hover:text-yellow-600">
                  Configuration
                </a>
                <a href="#advanced-features" className="block text-sm hover:text-yellow-600">
                  Advanced Features
                </a>
                <a href="#error-handling" className="block text-sm hover:text-yellow-600">
                  Error Handling
                </a>
                <a href="#events" className="block text-sm hover:text-yellow-600">
                  Events
                </a>
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* SolidisClient */}
          <section id="solidisclient">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-yellow-600" />
                  SolidisClient
                </CardTitle>
                <CardDescription>The main client class for interacting with Redis servers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Constructor</h3>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                      <div>new SolidisClient(options?: SolidisOptions)</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Parameters</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline">options</Badge>
                        <div>
                          <div className="font-medium">SolidisOptions</div>
                          <div className="text-sm text-gray-600">Optional configuration object</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Connection Methods */}
          <section id="connection">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Connection Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="connect" className="w-full">
                  <TabsList>
                    <TabsTrigger value="connect">connect()</TabsTrigger>
                    <TabsTrigger value="disconnect">disconnect()</TabsTrigger>
                    <TabsTrigger value="isConnected">isConnected()</TabsTrigger>
                  </TabsList>

                  <TabsContent value="connect" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                      <div className="text-blue-400">async</div> connect(): Promise{"<void>"}
                    </div>
                    <p className="text-sm text-gray-600">
                      Establishes a connection to the Redis server. Must be called before performing any operations.
                    </p>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium mb-2">Example:</div>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                        <div>const client = new SolidisClient();</div>
                        <div>await client.connect();</div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="disconnect" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                      <div className="text-blue-400">async</div> disconnect(): Promise{"<void>"}
                    </div>
                    <p className="text-sm text-gray-600">
                      Closes the connection to the Redis server and cleans up resources.
                    </p>
                  </TabsContent>

                  <TabsContent value="isConnected" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                      isConnected(): boolean
                    </div>
                    <p className="text-sm text-gray-600">
                      Returns true if the client is currently connected to the server.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          {/* Basic Operations */}
          <section id="basic-operations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5 text-yellow-600" />
                  Basic Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">String Operations</h3>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm mb-3">
                          <div className="text-blue-400">async</div> set(key: string, value: string, options?:
                          SetOptions): Promise{"<string>"}
                        </div>
                        <p className="text-sm text-gray-600">Sets a key to hold the string value.</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm mb-3">
                          <div className="text-blue-400">async</div> get(key: string): Promise{"<string | null>"}
                        </div>
                        <p className="text-sm text-gray-600">Gets the value of a key.</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm mb-3">
                          <div className="text-blue-400">async</div> del(key: string): Promise{"<number>"}
                        </div>
                        <p className="text-sm text-gray-600">Deletes a key.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Example Usage</h3>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                      <div className="text-green-400">// Set a value</div>
                      <div>await client.set('user:123', 'John Doe');</div>

                      <div className="mt-3 text-green-400">// Get a value</div>
                      <div>const user = await client.get('user:123');</div>
                      <div>console.log(user); // 'John Doe'</div>

                      <div className="mt-3 text-green-400">// Delete a key</div>
                      <div>await client.del('user:123');</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Advanced Operations */}
          <section id="advanced-operations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-yellow-600" />
                  Advanced Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="transactions" className="w-full">
                  <TabsList>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
                    <TabsTrigger value="pubsub">Pub/Sub</TabsTrigger>
                  </TabsList>

                  <TabsContent value="transactions" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="text-green-400">// Start a transaction</div>
                      <div>const transaction = client.multi();</div>
                      <div className="mt-2 text-green-400">// Queue commands (no await needed)</div>
                      <div>transaction.set('key', 'value');</div>
                      <div>transaction.incr('counter');</div>
                      <div>transaction.get('key');</div>
                      <div className="mt-2 text-green-400">// Execute transaction</div>
                      <div>const results = await transaction.exec();</div>
                      <div>console.log(results); // [[ 'OK' ], [ 1 ], [ &lt;Buffer 76 61 6c 75 65&gt; ]]</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Redis transactions allow the execution of a group of commands in a single step, with two important
                      guarantees: all the commands in a transaction are serialized and executed sequentially, and either
                      all or none of the commands are processed.
                    </p>
                  </TabsContent>

                  <TabsContent value="pipelines" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="text-green-400">// Create commands for a pipeline</div>
                      <div>const commands = [</div>
                      <div className="ml-2">['set', 'pipeline', 'value'],</div>
                      <div className="ml-2">['incr', 'counter'],</div>
                      <div className="ml-2">['get', 'pipeline']</div>
                      <div>];</div>
                      <div className="mt-2 text-green-400">// Send commands as a pipeline</div>
                      <div>const results = await client.send(commands);</div>
                      <div>console.log(results); // [[ 'OK' ], [ 1 ], [ &lt;Buffer 76 61 6c 75 65&gt; ]]</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Pipelining is a technique to improve performance by sending multiple commands to the server
                      without waiting for the replies, and then reading all the replies in a single step. This reduces
                      the round-trip time for multiple commands.
                    </p>
                  </TabsContent>

                  <TabsContent value="pubsub" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="text-green-400">// Subscribe to channels</div>
                      <div>{"client.on('message', (channel, message) => {"}</div>
                      <div className="ml-2">{"  console.log(`Received ${message} from ${channel}`);"}</div>
                      <div>{"});"}</div>
                      <div className="mt-2">await client.subscribe('news');</div>
                      <div className="mt-4 text-green-400">// Publish from another client</div>
                      <div>await client.publish('news', 'Hello world!');</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Redis Pub/Sub implements the messaging paradigm where senders (publishers) send messages to a
                      channel, without knowledge of what subscribers (if any) there may be. Subscribers express interest
                      in one or more channels and only receive messages that are of interest.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          {/* Configuration */}
          <section id="configuration">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-yellow-600" />
                  Configuration Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <div>const client = new SolidisClient({"{"}</div>
                  <div className="ml-4 text-blue-400">// Connection</div>
                  <div className="ml-4">uri: 'redis://localhost:6379',</div>
                  <div className="ml-4">host: '127.0.0.1',</div>
                  <div className="ml-4">port: 6379,</div>
                  <div className="ml-4">useTLS: false,</div>
                  <div className="ml-4">lazyConnect: false,</div>
                  <div className="mt-2 ml-4 text-blue-400">// Authentication</div>
                  <div className="ml-4">authentication: {"{"}</div>
                  <div className="ml-8">username: 'user',</div>
                  <div className="ml-8">password: 'password'</div>
                  <div className="ml-4">{"}"},</div>
                  <div className="ml-4">database: 0,</div>
                  <div className="mt-2 ml-4 text-blue-400">// Protocol & Recovery</div>
                  <div className="ml-4">clientName: 'solidis',</div>
                  <div className="ml-4">protocol: 'RESP2', // 'RESP2' or 'RESP3'</div>
                  <div className="ml-4">autoReconnect: true,</div>
                  <div className="ml-4">enableReadyCheck: true,</div>
                  <div className="ml-4">maxConnectionRetries: 20,</div>
                  <div className="ml-4">connectionRetryDelay: 100,</div>
                  <div className="mt-2 ml-4 text-blue-400">// Timeouts (milliseconds)</div>
                  <div className="ml-4">commandTimeout: 5000,</div>
                  <div className="ml-4">connectionTimeout: 2000,</div>
                  <div className="ml-4">socketWriteTimeout: 1000,</div>
                  <div className="ml-4">readyCheckInterval: 100,</div>
                  <div className="mt-2 ml-4 text-blue-400">// Performance Tuning</div>
                  <div className="ml-4">maxCommandsPerPipeline: 300,</div>
                  <div className="ml-4">maxProcessRepliesPerChunk: 4 * 1024, // 4KB</div>
                  <div className="ml-4">maxSocketWriteSizePerOnce: 64 * 1024, // 64KB</div>
                  <div className="ml-4">rejectOnPartialPipelineError: false,</div>
                  <div className="mt-2 ml-4 text-blue-400">// Debug Options</div>
                  <div className="ml-4">debug: false,</div>
                  <div className="ml-4">debugMaxEntries: 10 * 1024,</div>
                  <div>{"}"});</div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Advanced Features */}
          <section id="advanced-features">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-yellow-600" />
                  Advanced Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="custom-commands" className="w-full">
                  <TabsList>
                    <TabsTrigger value="custom-commands">Custom Commands</TabsTrigger>
                    <TabsTrigger value="raw-commands">Raw Commands</TabsTrigger>
                    <TabsTrigger value="debugging">Debugging</TabsTrigger>
                  </TabsList>

                  <TabsContent value="custom-commands" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="text-green-400">// Import the client and commands</div>
                      <div>import {"{ SolidisClient }"} from '@vcms-io/solidis';</div>
                      <div>import {"{ get, set }"} from '@vcms-io/solidis/command';</div>
                      <div className="mt-2">import type {"{ SolidisClientExtensions }"} from '@vcms-io/solidis';</div>
                      <div className="mt-4 text-green-400">// Define extensions with custom commands</div>
                      <div>const extensions = {"{"}</div>
                      <div className="ml-2">get,</div>
                      <div className="ml-2">set,</div>
                      <div className="ml-2 text-green-400">// Custom command implementation</div>
                      <div className="ml-2">
                        fill: async function(this: typeof client, keys: string[], value: string) {"{"}
                      </div>
                      <div className="ml-4">{"return await Promise.all(keys.map((key) => this.set(key, value)));"}</div>
                      <div className="ml-2">{"}"},</div>
                      <div>{"}"} satisfies SolidisClientExtensions;</div>
                      <div className="mt-4 text-green-400">// Initialize client with extensions</div>
                      <div>const client = new SolidisClient({"{"}</div>
                      <div className="ml-2">host: '127.0.0.1',</div>
                      <div className="ml-2">port: 6379</div>
                      <div>{"}"}).extend(extensions);</div>
                      <div className="mt-4 text-green-400">// Use custom command</div>
                      <div>await client.fill(['key1', 'key2', 'key3'], 'value');</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      You can extend Solidis with custom commands to create higher-level abstractions or implement
                      specialized functionality for your application.
                    </p>
                  </TabsContent>

                  <TabsContent value="raw-commands" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="text-green-400">// Using raw commands with send()</div>
                      <div>const result = await client.send([['command', 'some', 'options']]);</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      When you need to use a command that's not yet implemented or for more direct control, you can use
                      the raw send method to execute any Redis command.
                    </p>
                  </TabsContent>

                  <TabsContent value="debugging" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="text-green-400">// Enable debug mode</div>
                      <div>const client = new SolidisClient({"{"}</div>
                      <div className="ml-2">debug: true</div>
                      <div>{"}"});</div>
                      <div className="mt-4 text-green-400">// Listen for debug events</div>
                      <div>{"client.on('debug', (entry) => {"}</div>
                      <div className="ml-2">{"  console.log(`[${entry.type}] ${entry.message}`, entry.data);"}</div>
                      <div>{"});"}</div>
                      <div className="mt-4 text-green-400">// Alternative: environment variable</div>
                      <div className="text-gray-400">// DEBUG=solidis node app.js</div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Solidis provides detailed debugging capabilities to help you troubleshoot issues and understand
                      the internal workings of the client.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          {/* Error Handling */}
          <section id="error-handling">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Error Handling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <div className="text-green-400">// Import error classes</div>
                  <div>import {"{"}</div>
                  <div className="ml-2">SolidisClientError,</div>
                  <div className="ml-2">SolidisConnectionError,</div>
                  <div className="ml-2">SolidisParserError,</div>
                  <div className="ml-2">SolidisPubSubError,</div>
                  <div className="ml-2">SolidisRequesterError,</div>
                  <div className="ml-2">unwrapSolidisError,</div>
                  <div>{"}"} from '@vcms-io/solidis';</div>
                  <div className="mt-4 text-green-400">// Error handling example</div>
                  <div>try {"{"}</div>
                  <div className="ml-2">await client.set('key', 'value');</div>
                  <div>
                    {"}"} catch (error) {"{"}
                  </div>
                  <div className="ml-2 text-green-400">// Get the root cause with stack trace</div>
                  <div className="ml-2">console.error(unwrapSolidisError(error));</div>
                  <div className="mt-2 ml-2 text-green-400">// Handle specific error types</div>
                  <div className="ml-2">if (error instanceof SolidisConnectionError) {"{"}</div>
                  <div className="ml-4">console.error('Connection error:', error.message);</div>
                  <div className="ml-2">
                    {"}"} else if (error instanceof SolidisParserError) {"{"}
                  </div>
                  <div className="ml-4">console.error('Parser error:', error.message);</div>
                  <div className="ml-2">
                    {"}"} else if (error instanceof SolidisClientError) {"{"}
                  </div>
                  <div className="ml-4">console.error('Client error:', error.message);</div>
                  <div className="ml-2">{"}"}</div>
                  <div>{"}"}</div>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-3">Error Types</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">SolidisClientError</Badge>
                      <span className="text-sm text-gray-600">Base error class for all Solidis errors</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">SolidisConnectionError</Badge>
                      <span className="text-sm text-gray-600">Errors related to connection issues</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">SolidisParserError</Badge>
                      <span className="text-sm text-gray-600">Errors during RESP protocol parsing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">SolidisPubSubError</Badge>
                      <span className="text-sm text-gray-600">Errors related to Pub/Sub operations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">SolidisRequesterError</Badge>
                      <span className="text-sm text-gray-600">Errors during command execution</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Events */}
          <section id="events">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <div className="text-green-400">// Connection events</div>
                  <div>{"client.on('connect', () => console.log('Connected to server'));"}</div>
                  <div>{"client.on('ready', () => console.log('Client is ready'));"}</div>
                  <div>{"client.on('end', () => console.log('Connection closed'));"}</div>
                  <div>{"client.on('error', (err) => console.error('Error:', err));"}</div>
                  <div className="mt-4 text-green-400">// Pub/Sub events</div>
                  <div>{"client.on('message', (channel, message) => console.log(`${channel}: ${message}`));"}</div>
                  <div>
                    {
                      "client.on('pmessage', (pattern, channel, message) => console.log(`${pattern} ${channel}: ${message}`));"
                    }
                  </div>
                  <div>{"client.on('subscribe', (channel, count) => console.log(`Subscribed to ${channel}`));"}</div>
                  <div>
                    {"client.on('unsubscribe', (channel, count) => console.log(`Unsubscribed from ${channel}`));"}
                  </div>
                  <div className="mt-4 text-green-400">// Debug events</div>
                  <div>{"client.on('debug', (entry) => console.log(`[${entry.type}] ${entry.message}`));"}</div>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-3">Event Types</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">connect</Badge>
                      <span className="text-sm text-gray-600">Emitted when the client connects to the server</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">ready</Badge>
                      <span className="text-sm text-gray-600">Emitted when the client is ready to send commands</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">end</Badge>
                      <span className="text-sm text-gray-600">Emitted when the connection is closed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">error</Badge>
                      <span className="text-sm text-gray-600">Emitted when an error occurs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline">message</Badge>
                      <span className="text-sm text-gray-600">
                        Emitted when a message is received on a subscribed channel
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
