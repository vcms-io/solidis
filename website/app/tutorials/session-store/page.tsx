import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, User, CheckCircle, ArrowRight, Code } from "lucide-react"
import Link from "next/link"

export default function SessionStoreTutorial() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/tutorials" className="text-yellow-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Tutorials
        </Link>
        <div className="flex items-center gap-4 mb-4">
          <Badge className="bg-green-100 text-green-800">Beginner</Badge>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">15 min</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <User className="h-4 w-4" />
            <span className="text-sm">Beginner friendly</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Building a Session Store with Redis</h1>
        <p className="text-xl text-gray-600">
          Learn how to implement a Redis-based session store for web applications using Solidis. Perfect for
          authentication and user state management.
        </p>
      </div>

      {/* What You'll Learn */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What You'll Learn</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>How to store and retrieve session data in Redis</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Implementing session expiration and TTL</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Creating a session manager class</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Integrating with Express.js middleware</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Prerequisites</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-yellow-600">•</span>
              <span>Node.js 14+ installed</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-600">•</span>
              <span>Redis server running locally or remotely</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-600">•</span>
              <span>Basic understanding of Express.js</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-600">•</span>
              <span>Familiarity with TypeScript (optional)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Setup */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              1
            </div>
            Project Setup
          </CardTitle>
          <CardDescription>Install dependencies and initialize the project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Install Dependencies</h4>
            <Tabs defaultValue="npm" className="w-full">
              <TabsList>
                <TabsTrigger value="npm">npm</TabsTrigger>
                <TabsTrigger value="yarn">yarn</TabsTrigger>
                <TabsTrigger value="pnpm">pnpm</TabsTrigger>
              </TabsList>
              <TabsContent value="npm">
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  npm install @vcms-io/solidis express uuid
                </div>
              </TabsContent>
              <TabsContent value="yarn">
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  yarn add @vcms-io/solidis express uuid
                </div>
              </TabsContent>
              <TabsContent value="pnpm">
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  pnpm add @vcms-io/solidis express uuid
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <h4 className="font-semibold mb-2">TypeScript (Optional)</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
              npm install -D @types/express @types/uuid typescript
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Create Session Manager */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              2
            </div>
            Create Session Manager Class
          </CardTitle>
          <CardDescription>Build a reusable session manager using Solidis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  userId: string;
  username: string;
  email: string;
  createdAt: number;
  [key: string]: any;
}

export class SessionStore {
  private client: SolidisFeaturedClient;
  private prefix: string;
  private ttl: number; // in seconds

  constructor(options: {
    host?: string;
    port?: number;
    prefix?: string;
    ttl?: number;
  } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.prefix = options.prefix || 'session:';
    this.ttl = options.ttl || 3600; // 1 hour default
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  private getKey(sessionId: string): string {
    return \`\${this.prefix}\${sessionId}\`;
  }

  async create(data: SessionData): Promise<string> {
    const sessionId = uuidv4();
    const key = this.getKey(sessionId);

    const sessionData = {
      ...data,
      createdAt: Date.now(),
    };

    await this.client.set(
      key,
      JSON.stringify(sessionData),
      { EX: this.ttl }
    );

    return sessionId;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const key = this.getKey(sessionId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data.toString());
  }

  async update(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
    const key = this.getKey(sessionId);
    const existingData = await this.get(sessionId);

    if (!existingData) {
      return false;
    }

    const updatedData = { ...existingData, ...data };
    await this.client.set(
      key,
      JSON.stringify(updatedData),
      { EX: this.ttl }
    );

    return true;
  }

  async destroy(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.client.del(key);
    return result > 0;
  }

  async refresh(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.client.expire(key, this.ttl);
    return result === 1;
  }

  async exists(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.client.exists(key);
    return result === 1;
  }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Express Middleware */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              3
            </div>
            Create Express Middleware
          </CardTitle>
          <CardDescription>Integrate the session store with Express.js</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`import express, { Request, Response, NextFunction } from 'express';
import { SessionStore, SessionData } from './session-store';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: SessionData;
      sessionId?: string;
    }
  }
}

export function createSessionMiddleware(store: SessionStore) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Get session ID from cookie
    const sessionId = req.cookies?.sessionId;

    if (sessionId) {
      // Try to load existing session
      const session = await store.get(sessionId);

      if (session) {
        req.session = session;
        req.sessionId = sessionId;

        // Refresh session TTL on each request
        await store.refresh(sessionId);
      } else {
        // Session expired, clear cookie
        res.clearCookie('sessionId');
      }
    }

    // Add helper methods to response
    res.locals.createSession = async (data: SessionData) => {
      const sessionId = await store.create(data);
      req.sessionId = sessionId;
      req.session = data;

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000, // 1 hour
        sameSite: 'strict',
      });

      return sessionId;
    };

    res.locals.destroySession = async () => {
      if (req.sessionId) {
        await store.destroy(req.sessionId);
        res.clearCookie('sessionId');
        delete req.session;
        delete req.sessionId;
      }
    };

    next();
  };
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Usage Example */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              4
            </div>
            Usage Example
          </CardTitle>
          <CardDescription>Putting it all together in your Express app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`import express from 'express';
import cookieParser from 'cookie-parser';
import { SessionStore } from './session-store';
import { createSessionMiddleware } from './session-middleware';

const app = express();
const sessionStore = new SessionStore({
  host: '127.0.0.1',
  port: 6379,
  prefix: 'myapp:session:',
  ttl: 3600, // 1 hour
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(createSessionMiddleware(sessionStore));

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Validate credentials (simplified)
  if (username === 'demo' && password === 'password') {
    const sessionId = await res.locals.createSession({
      userId: '123',
      username: 'demo',
      email: 'demo@example.com',
      createdAt: Date.now(),
    });

    return res.json({
      success: true,
      sessionId,
      message: 'Logged in successfully',
    });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// Protected endpoint
app.get('/api/profile', (req, res) => {
  if (!req.session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email,
    },
  });
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  await res.locals.destroySession();
  res.json({ message: 'Logged out successfully' });
});

// Start server
async function start() {
  await sessionStore.connect();
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

start().catch(console.error);`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Testing */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-yellow-600" />
            Testing Your Session Store
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Test Login</h4>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                {`curl -X POST http://localhost:3000/api/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"demo","password":"password"}' \\
  -c cookies.txt`}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Test Protected Endpoint</h4>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                {`curl http://localhost:3000/api/profile -b cookies.txt`}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Test Logout</h4>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                {`curl -X POST http://localhost:3000/api/logout -b cookies.txt`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Best Practices & Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Use secure cookies in production</div>
                <div className="text-sm text-gray-600">
                  Always set <code className="bg-gray-100 px-1 py-0.5 rounded">httpOnly</code>,{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded">secure</code>, and{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded">sameSite</code> flags
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Implement session rotation</div>
                <div className="text-sm text-gray-600">
                  Regenerate session IDs after login to prevent session fixation attacks
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Set appropriate TTL values</div>
                <div className="text-sm text-gray-600">
                  Balance between user experience and security based on your application needs
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Use connection pooling</div>
                <div className="text-sm text-gray-600">
                  Reuse Redis connections across requests for better performance
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Monitor session counts</div>
                <div className="text-sm text-gray-600">
                  Use <code className="bg-gray-100 px-1 py-0.5 rounded">SCAN</code> command to track active sessions
                </div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-yellow-600" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/tutorials/cache-layer"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">Cache Layer Tutorial</h3>
              <p className="text-sm text-gray-600">Learn how to implement caching for better performance</p>
            </Link>
            <Link
              href="/tutorials/rate-limiting"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">Rate Limiting Tutorial</h3>
              <p className="text-sm text-gray-600">Protect your APIs with Redis-based rate limiting</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
