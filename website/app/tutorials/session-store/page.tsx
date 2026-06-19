'use client';

import { ArrowRight, CheckCircle, Clock, Code, User } from 'lucide-react';
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

export default function SessionStoreTutorial() {
  const { t } = useI18n();

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tutorials"
          className="text-amber-500 hover:underline text-sm mb-4 inline-block"
        >
          {t('tutorialSession.backToTutorials')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <Badge className="bg-emerald-500/10 text-emerald-600">
            {t('tutorialSession.level')}
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{t('tutorialSession.duration')}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-sm">{t('tutorialSession.levelDesc')}</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          {t('tutorialSession.title')}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t('tutorialSession.description')}
        </p>
      </div>

      {/* What You'll Learn */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialSession.whatYoullLearn')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialSession.learn1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialSession.learn2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialSession.learn3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialSession.learn4')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialSession.prerequisites')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-amber-500">•</span>
              <span>{t('tutorialSession.prereq1')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-500">•</span>
              <span>{t('tutorialSession.prereq2')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-500">•</span>
              <span>{t('tutorialSession.prereq3')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-500">•</span>
              <span>{t('tutorialSession.prereq4')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Setup */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              1
            </div>
            {t('tutorialSession.projectSetup')}
          </CardTitle>
          <CardDescription>
            {t('tutorialSession.projectSetupDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <h4 className="font-semibold mb-2">
              {t('tutorialSession.installDeps')}
            </h4>
            <Tabs defaultValue="npm" className="w-full">
              <TabsList>
                <TabsTrigger value="npm">npm</TabsTrigger>
                <TabsTrigger value="yarn">yarn</TabsTrigger>
                <TabsTrigger value="pnpm">pnpm</TabsTrigger>
              </TabsList>
              <TabsContent value="npm" className="space-y-4">
                <CodeBlock
                  code="npm install @vcms-io/solidis express uuid"
                  language="bash"
                />
                <div>
                  <h4 className="font-semibold mb-2">
                    {t('tutorialSession.tsOptional')}
                  </h4>
                  <CodeBlock
                    code="npm install -D @types/express @types/uuid typescript"
                    language="bash"
                  />
                </div>
              </TabsContent>
              <TabsContent value="yarn" className="space-y-4">
                <CodeBlock
                  code="yarn add @vcms-io/solidis express uuid"
                  language="bash"
                />
                <div>
                  <h4 className="font-semibold mb-2">
                    {t('tutorialSession.tsOptional')}
                  </h4>
                  <CodeBlock
                    code="yarn add -D @types/express @types/uuid typescript"
                    language="bash"
                  />
                </div>
              </TabsContent>
              <TabsContent value="pnpm" className="space-y-4">
                <CodeBlock
                  code="pnpm add @vcms-io/solidis express uuid"
                  language="bash"
                />
                <div>
                  <h4 className="font-semibold mb-2">
                    {t('tutorialSession.tsOptional')}
                  </h4>
                  <CodeBlock
                    code="pnpm add -D @types/express @types/uuid typescript"
                    language="bash"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Create Session Manager */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              2
            </div>
            {t('tutorialSession.createSessionManager')}
          </CardTitle>
          <CardDescription>
            {t('tutorialSession.createSessionManagerDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';
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

  disconnect(): void {
    this.client.quit();
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
      { expireInSeconds: this.ttl }
    );

    return sessionId;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const key = this.getKey(sessionId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
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
      { expireInSeconds: this.ttl }
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
    return result > 0;
  }

  async exists(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.client.exists(key);
    return result === 1;
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Express Middleware */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              3
            </div>
            {t('tutorialSession.createMiddleware')}
          </CardTitle>
          <CardDescription>
            {t('tutorialSession.createMiddlewareDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import express, { Request, Response, NextFunction } from 'express';
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
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Usage Example */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              4
            </div>
            {t('tutorialSession.usageExample')}
          </CardTitle>
          <CardDescription>
            {t('tutorialSession.usageExampleDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import express from 'express';
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

start().catch(console.error);`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Testing */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-amber-500" />
            {t('tutorialSession.testing')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">
                {t('tutorialSession.testLogin')}
              </h4>
              <CodeBlock
                code={`curl -X POST http://localhost:3000/api/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"demo","password":"password"}' \\
  -c cookies.txt`}
                language="bash"
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                {t('tutorialSession.testProtected')}
              </h4>
              <CodeBlock
                code={'curl http://localhost:3000/api/profile -b cookies.txt'}
                language="bash"
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                {t('tutorialSession.testLogout')}
              </h4>
              <CodeBlock
                code={
                  'curl -X POST http://localhost:3000/api/logout -b cookies.txt'
                }
                language="bash"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialSession.bestPractices')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialSession.tip1Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialSession.tip1Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialSession.tip2Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialSession.tip2Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialSession.tip3Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialSession.tip3Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialSession.tip4Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialSession.tip4Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialSession.tip5Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialSession.tip5Desc')}
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
            <ArrowRight className="h-5 w-5 text-amber-500" />
            {t('tutorialSession.nextSteps')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/tutorials/cache-layer"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialSession.nextCache')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialSession.nextCacheDesc')}
              </p>
            </Link>
            <Link
              href="/tutorials/rate-limiting"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialSession.nextRate')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialSession.nextRateDesc')}
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
