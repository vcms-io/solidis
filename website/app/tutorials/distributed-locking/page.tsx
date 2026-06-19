'use client';

import { ArrowRight, CheckCircle, Clock, Lock } from 'lucide-react';
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
import { useI18n } from '@/lib/i18n-context';

const PACKAGE_NAME = '@vcms-io/solidis-extensions';

export default function DistributedLockingTutorial() {
  const { t } = useI18n();
  const redlockNoteParts = t('tutorialLocking.redlockNote').split(PACKAGE_NAME);

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-8">
        <Link
          href="/tutorials"
          className="text-amber-500 hover:underline text-sm mb-4 inline-block"
        >
          {t('tutorialLocking.backToTutorials')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <Badge className="bg-red-500/10 text-red-500">
            {t('tutorialLocking.level')}
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{t('tutorialLocking.duration')}</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          {t('tutorialLocking.title')}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t('tutorialLocking.description')}
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialLocking.whatYoullLearn')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialLocking.learn1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialLocking.learn2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialLocking.learn3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialLocking.learn4')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              1
            </div>
            {t('tutorialLocking.simpleLock')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';
import { randomUUID } from 'crypto';

export class DistributedLock {
  private client: SolidisFeaturedClient;
  private prefix: string;

  constructor(options: { host?: string; port?: number; prefix?: string } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.prefix = options.prefix || 'lock:';
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Acquire a lock
   */
  async acquire(
    resource: string,
    ttlMs: number = 10000
  ): Promise<string | null> {
    const key = \`\${this.prefix}\${resource}\`;
    const value = randomUUID();
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    // SET NX EX: Set if not exists with expiry
    const result = await this.client.set(key, value, {
      setIfKeyNotExists: true,
      expireInSeconds: ttlSeconds,
    });

    return result !== null ? value : null;
  }

  /**
   * Release a lock
   */
  async release(resource: string, token: string): Promise<boolean> {
    const key = \`\${this.prefix}\${resource}\`;

    // Use Lua script to ensure atomicity
    const script = \`
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    \`;

    const result = await this.client.eval(script, [key], [token]);

    return result === 1;
  }

  /**
   * Extend lock TTL
   */
  async extend(
    resource: string,
    token: string,
    ttlMs: number
  ): Promise<boolean> {
    const key = \`\${this.prefix}\${resource}\`;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    const script = \`
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    \`;

    const result = await this.client.eval(script, [key], [token, ttlSeconds.toString()]);

    return result === 1;
  }

  /**
   * Execute function with lock
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options: {
      ttlMs?: number;
      retryDelayMs?: number;
      retryCount?: number;
    } = {}
  ): Promise<T> {
    const {
      ttlMs = 10000,
      retryDelayMs = 100,
      retryCount = 10,
    } = options;

    let token: string | null = null;
    let attempts = 0;

    // Try to acquire lock with retries
    while (attempts < retryCount) {
      token = await this.acquire(resource, ttlMs);
      if (token) break;

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    if (!token) {
      throw new Error(\`Failed to acquire lock for \${resource}\`);
    }

    try {
      return await fn();
    } finally {
      await this.release(resource, token);
    }
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              2
            </div>
            {t('tutorialLocking.usageExamples')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { DistributedLock } from './distributed-lock';

const lock = new DistributedLock();
await lock.connect();

// Example 1: Prevent duplicate payment processing
async function processPayment(orderId: string, amount: number) {
  await lock.withLock(
    \`payment:\${orderId}\`,
    async () => {
      // Check if payment already processed
      const order = await db.getOrder(orderId);
      if (order.status === 'paid') {
        return;
      }

      // Process payment
      await paymentGateway.charge(amount);

      // Update order status
      await db.updateOrder(orderId, { status: 'paid' });
    },
    { ttlMs: 30000 } // 30 seconds
  );
}

// Example 2: Ensure single cron job execution
async function dailyReportJob() {
  const token = await lock.acquire('cron:daily-report', 300000); // 5 min

  if (!token) {
    console.log('Job already running');
    return;
  }

  try {
    await generateDailyReport();
  } finally {
    await lock.release('cron:daily-report', token);
  }
}

// Example 3: Coordinate resource updates
async function updateUserProfile(userId: string, data: any) {
  await lock.withLock(\`user:\${userId}\`, async () => {
    const user = await db.getUser(userId);
    const updatedUser = { ...user, ...data };
    await db.updateUser(userId, updatedUser);
    await cache.invalidate(\`user:\${userId}\`);
  });
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            {t('tutorialLocking.redlock')}
          </CardTitle>
          <CardDescription>{t('tutorialLocking.redlockDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {redlockNoteParts.length === 2 ? (
              <>
                {redlockNoteParts[0]}
                <a
                  href="https://github.com/vcms-io/solidis-extensions"
                  className="text-amber-500 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {PACKAGE_NAME}
                </a>
                {redlockNoteParts[1]}
              </>
            ) : (
              t('tutorialLocking.redlockNote')
            )}
          </p>
          <CodeBlock
            code="npm install @vcms-io/solidis-extensions"
            language="bash"
          />
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialLocking.bestPractices')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialLocking.tip1Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialLocking.tip1Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialLocking.tip2Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialLocking.tip2Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">
                  {t('tutorialLocking.tip3Title')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialLocking.tip3Desc')}
                </div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-amber-500" />
            {t('tutorialLocking.nextSteps')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/tutorials/job-queue"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialLocking.nextJobQueue')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialLocking.nextJobQueueDesc')}
              </p>
            </Link>
            <Link
              href="/tutorials/cache-layer"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialLocking.nextCache')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialLocking.nextCacheDesc')}
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
