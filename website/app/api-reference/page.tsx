"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Code, Book, Zap, Settings, Layers, Terminal, AlertTriangle } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { CodeBlock } from '@/components/code-block'

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
                    <CodeBlock code={`new SolidisClient(options?: SolidisOptions)`} language="typescript" showLineNumbers={true} />
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
                      <CodeBlock code={`const client = new SolidisClient();
await client.connect();`} language="typescript" showLineNumbers={true} />
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
                      <CodeBlock code={`// Set a value
await client.set('user:123', 'John Doe');

// Get a value
const user = await client.get('user:123');
console.log(user); // 'John Doe'

// Delete a key
await client.del('user:123');`} language="typescript" showLineNumbers={true} />
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
                      <CodeBlock code={`// Start a transaction
const transaction = client.multi();

// Queue commands (no await needed)
transaction.set('key', 'value');
transaction.incr('counter');
transaction.get('key');

// Execute transaction
const results = await transaction.exec();

console.log(results); // [[ 'OK' ], [ 1 ], [ &lt;Buffer 76 61 6c 75 65&gt; ]]</div>
                      `} language="typescript" showLineNumbers={true} />
                    </div>
                    <p className="text-sm text-gray-600">
                      Redis transactions allow the execution of a group of commands in a single step, with two important
                      guarantees: all the commands in a transaction are serialized and executed sequentially, and either
                      all or none of the commands are processed.
                    </p>
                  </TabsContent>

                  <TabsContent value="pipelines" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <CodeBlock code={`// Create commands for a pipeline
const commands = [
  ['set', 'pipeline', 'value'],
  ['incr', 'counter'],
  ['get', 'pipeline']
];

// Send commands as a pipeline
const results = await client.send(commands);

console.log(results); // [[ 'OK' ], [ 1 ], [ &lt;Buffer 76 61 6c 75 65&gt; ]]</div>
                      `} language="typescript" showLineNumbers={true} />
                    </div>
                    <p className="text-sm text-gray-600">
                      Pipelining is a technique to improve performance by sending multiple commands to the server
                      without waiting for the replies, and then reading all the replies in a single step. This reduces
                      the round-trip time for multiple commands.
                    </p>
                  </TabsContent>

                  <TabsContent value="pubsub" className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <CodeBlock code={`// Subscribe to channels
client.on('message', (channel, message) => {
  console.log(\`Received \${message} from \${channel}\`);
});

await client.subscribe('news');`} language="typescript" showLineNumbers={true} />
                      <CodeBlock code={`// Publish from another client
await client.publish('news', 'Hello world!');`} language="typescript" showLineNumbers={true} />
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
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-a uto">
                  <CodeBlock code={`const client = new SolidisClient({
  uri: 'redis://localhost:6379',
  host: '127.0.0.1',
  port: 6379,
  useTLS: false,
  lazyConnect: false,
  authentication: {
    username: 'user',
    password: 'password'
  },
  database: 0,
  clientName: 'solidis',
  protocol: 'RESP2', // 'RESP2' or 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,
  commandTimeout: 5000,
  connectionTimeout: 2000,
  socketWriteTimeout: 1000,
  readyCheckInterval: 100,
  maxCommandsPerPipeline: 300,
  maxProcessRepliesPerChunk: 4 * 1024, // 4KB
  maxSocketWriteSizePerOnce: 64 * 1024, // 64KB
  rejectOnPartialPipelineError: false,
  debug: false,
  debugMaxEntries: 10 * 1024,
});`} language="typescript" showLineNumbers={true} />
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
                    <CodeBlock code={`// Import the client and commands
import { SolidisClient } from '@vcms-io/solidis';
import { get, set } from '@vcms-io/solidis/command';
import type { SolidisClientExtensions } from '@vcms-io/solidis';

// Define extensions with custom commands
const extensions = {
  get,
  set,
  // Custom command implementation
  fill: async function(this: typeof client, keys: string[], value: string) {
    return await Promise.all(keys.map((key) => this.set(key, value)));
  },
} satisfies SolidisClientExtensions;

// Initialize client with extensions
const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);

// Use custom command
await client.fill(['key1', 'key2', 'key3'], 'value');`} language="typescript" showLineNumbers={true} />
                    <p className="text-sm text-gray-600">
                      You can extend Solidis with custom commands to create higher-level abstractions or implement
                      specialized functionality for your application.
                    </p>
                  </TabsContent>

                  <TabsContent value="raw-commands" className="space-y-4">
                      <CodeBlock code={`// Using raw commands with send()
const result = await client.send([['command', 'some', 'options']]);`} language="typescript" showLineNumbers={true} />
                    <p className="text-sm text-gray-600">
                      When you need to use a command that's not yet implemented or for more direct control, you can use
                      the raw send method to execute any Redis command.
                    </p>
                  </TabsContent>

                  <TabsContent value="debugging" className="space-y-4">
                    <CodeBlock code={`// Enable debug mode
const client = new SolidisClient({
  debug: true
});

// Listen for debug events
client.on('debug', (entry) => {
  console.log(\`[\${entry.type}] \${entry.message}\`, entry.data);
});

// Alternative: environment variable
// DEBUG=solidis node app.js`} language="typescript" showLineNumbers={true} />
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
                <CodeBlock code={`// Import error classes
import {
  SolidisClientError,
  SolidisConnectionError,
  SolidisParserError,
  SolidisPubSubError,
  SolidisRequesterError,
  unwrapSolidisError,
} from '@vcms-io/solidis';

// Error handling example
try {
  await client.set('key', 'value');
} catch (error) {
  // Get the root cause with stack trace
  console.error(unwrapSolidisError(error));

  // Handle specific error types
  if (error instanceof SolidisConnectionError) {
    console.error('Connection error:', error.message);
  } else if (error instanceof SolidisParserError) {
    console.error('Parser error:', error.message);
  } else if (error instanceof SolidisClientError) {
    console.error('Client error:', error.message);
  }
}`} language="typescript" showLineNumbers={true} />
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
                <CodeBlock code={`// Connection events
client.on('connect', () => console.log('Connected to server'));
client.on('ready', () => console.log('Client is ready'));
client.on('end', () => console.log('Connection closed'));
client.on('error', (err) => console.error('Error:', err));

// Pub/Sub events
client.on('message', (channel, message) => console.log(\`\${channel}: \${message}\`));
client.on('pmessage', (pattern, channel, message) => console.log(\`\${pattern} \${channel}: \${message}\`));
client.on('subscribe', (channel, count) => console.log(\`Subscribed to \${channel}\`));
client.on('unsubscribe', (channel, count) => console.log(\`Unsubscribed from \${channel}\`));

// Debug events
client.on('debug', (entry) => console.log(\`[\${entry.type}] \${entry.message}\`));`} language="typescript" showLineNumbers={true} />
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
