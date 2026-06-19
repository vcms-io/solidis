'use client';

import { ArrowRight, CheckCircle, Clock, Shield } from 'lucide-react';
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

export default function RateLimitingTutorial() {
  const { t } = useI18n();

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tutorials"
          className="text-amber-500 hover:underline text-sm mb-4 inline-block"
        >
          {t('tutorialRate.backToTutorials')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <Badge className="bg-amber-500/10 text-amber-600">
            {t('tutorialRate.level')}
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{t('tutorialRate.duration')}</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          {t('tutorialRate.title')}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t('tutorialRate.description')}
        </p>
      </div>

      {/* What You'll Learn */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialRate.whatYoullLearn')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialRate.learn1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialRate.learn2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialRate.learn3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialRate.learn4')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Fixed Window */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              1
            </div>
            {t('tutorialRate.fixedWindow')}
          </CardTitle>
          <CardDescription>{t('tutorialRate.fixedWindowDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

export class FixedWindowRateLimiter {
  private client: SolidisFeaturedClient;
  private prefix: string;

  constructor(options: { host?: string; port?: number; prefix?: string } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.prefix = options.prefix || 'rate:';
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Check if request is allowed
   * @param key - Identifier (e.g., user ID, IP address)
   * @param limit - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSeconds * 1000));
    const cacheKey = \`\${this.prefix}\${key}:\${windowStart}\`;

    // Increment counter
    const count = await this.client.incr(cacheKey);

    // Set expiry on first request
    if (count === 1) {
      await this.client.expire(cacheKey, windowSeconds);
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = new Date((windowStart + 1) * windowSeconds * 1000);

    return { allowed, remaining, resetAt };
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Sliding Window */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              2
            </div>
            {t('tutorialRate.slidingWindow')}
          </CardTitle>
          <CardDescription>
            {t('tutorialRate.slidingWindowDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`export class SlidingWindowRateLimiter {
  private client: SolidisFeaturedClient;
  private prefix: string;

  constructor(options: { host?: string; port?: number; prefix?: string } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.prefix = options.prefix || 'rate:sliding:';
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Check if request is allowed using sliding window
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
    const cacheKey = \`\${this.prefix}\${key}\`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Remove old entries
    await this.client.zremrangebyscore(cacheKey, 0, windowStart);

    // Count requests in window
    const count = await this.client.zcard(cacheKey);

    const allowed = count < limit;

    if (allowed) {
      // Add current request
      await this.client.zadd(cacheKey, now, \`\${now}\`);
      // Set expiry
      await this.client.expire(cacheKey, windowSeconds);
    }

    const remaining = Math.max(0, limit - count - (allowed ? 1 : 0));

    // Calculate retry after (when oldest request will expire)
    let retryAfter = 0;
    if (!allowed && count > 0) {
      const oldest = await this.client.zrange(cacheKey, '0', '0', { withScores: true });
      if (oldest.length > 0) {
        const oldestScore = oldest[0].score;
        retryAfter = Math.ceil((oldestScore + windowSeconds * 1000 - now) / 1000);
      }
    }

    return { allowed, remaining, retryAfter };
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Token Bucket */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              3
            </div>
            {t('tutorialRate.tokenBucket')}
          </CardTitle>
          <CardDescription>{t('tutorialRate.tokenBucketDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`export class TokenBucketRateLimiter {
  private client: SolidisFeaturedClient;
  private prefix: string;

  constructor(options: { host?: string; port?: number; prefix?: string } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.prefix = options.prefix || 'rate:bucket:';
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Check if request is allowed using token bucket
   * @param capacity - Maximum tokens in bucket
   * @param refillRate - Tokens added per second
   */
  async checkLimit(
    key: string,
    capacity: number,
    refillRate: number
  ): Promise<{ allowed: boolean; tokens: number; retryAfter: number }> {
    const cacheKey = \`\${this.prefix}\${key}\`;
    const now = Date.now();

    // Get bucket state
    const result = await this.client.hmget(cacheKey, 'tokens', 'lastRefill');
    let tokens = result[0] ? Number.parseFloat(result[0]) : capacity;
    let lastRefill = result[1] ? Number.parseInt(result[1]) : now;

    // Calculate tokens to add
    const timePassed = (now - lastRefill) / 1000;
    const tokensToAdd = timePassed * refillRate;
    tokens = Math.min(capacity, tokens + tokensToAdd);

    const allowed = tokens >= 1;

    if (allowed) {
      tokens -= 1;
    }

    // Update bucket state
    await this.client.hset(cacheKey, 'tokens', tokens.toString());
    await this.client.hset(cacheKey, 'lastRefill', now.toString());
    await this.client.expire(cacheKey, Math.ceil(capacity / refillRate) + 60);

    const retryAfter = allowed ? 0 : Math.ceil((1 - tokens) / refillRate);

    return {
      allowed,
      tokens: Math.floor(tokens),
      retryAfter,
    };
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Express Middleware */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              4
            </div>
            {t('tutorialRate.expressMiddleware')}
          </CardTitle>
          <CardDescription>
            {t('tutorialRate.expressMiddlewareDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { Request, Response, NextFunction } from 'express';
import { SlidingWindowRateLimiter } from './sliding-window-limiter';

export interface RateLimitOptions {
  windowSeconds?: number;
  limit?: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

export function createRateLimiter(
  limiter: SlidingWindowRateLimiter,
  options: RateLimitOptions = {}
) {
  const {
    windowSeconds = 60,
    limit = 100,
    keyGenerator = (req) => req.ip || 'unknown',
    skip = () => false,
    handler = (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later',
      });
    },
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting if condition is met
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);

    try {
      const result = await limiter.checkLimit(key, limit, windowSeconds);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter.toString());
        return handler(req, res);
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request on error
      next();
    }
  };
}

// Usage examples
export function createUserRateLimiter(limiter: SlidingWindowRateLimiter) {
  return createRateLimiter(limiter, {
    windowSeconds: 60,
    limit: 100,
    keyGenerator: (req) => \`user:\${req.user?.id || req.ip}\`,
    skip: (req) => req.user?.role === 'admin',
  });
}

export function createAPIRateLimiter(limiter: SlidingWindowRateLimiter) {
  return createRateLimiter(limiter, {
    windowSeconds: 3600, // 1 hour
    limit: 1000,
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'] as string;
      return \`api:\${apiKey || req.ip}\`;
    },
  });
}

export function createLoginRateLimiter(limiter: SlidingWindowRateLimiter) {
  return createRateLimiter(limiter, {
    windowSeconds: 900, // 15 minutes
    limit: 5,
    keyGenerator: (req) => \`login:\${req.ip}\`,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many login attempts',
        message: 'Please try again in 15 minutes',
      });
    },
  });
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            {t('tutorialRate.completeExample')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import express from 'express';
import { SlidingWindowRateLimiter } from './sliding-window-limiter';
import {
  createUserRateLimiter,
  createAPIRateLimiter,
  createLoginRateLimiter,
} from './rate-limit-middleware';

const app = express();
const limiter = new SlidingWindowRateLimiter({
  host: '127.0.0.1',
  port: 6379,
});

app.use(express.json());

// Global rate limiter
app.use(createUserRateLimiter(limiter));

// Stricter rate limit for login
app.post('/api/login', createLoginRateLimiter(limiter), async (req, res) => {
  // Login logic
  res.json({ message: 'Login successful' });
});

// API key based rate limiting
app.use('/api/v1', createAPIRateLimiter(limiter));

app.get('/api/v1/data', (req, res) => {
  res.json({ data: 'sensitive data' });
});

// Start server
async function start() {
  await limiter.connect();
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

      {/* Best Practices */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialRate.bestPractices')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">{t('tutorialRate.tip1Title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialRate.tip1Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">{t('tutorialRate.tip2Title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialRate.tip2Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">{t('tutorialRate.tip3Title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialRate.tip3Desc')}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-1">✓</span>
              <div>
                <div className="font-medium">{t('tutorialRate.tip4Title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('tutorialRate.tip4Desc')}
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
            {t('tutorialRate.nextSteps')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/tutorials/distributed-locking"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialRate.nextLocking')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialRate.nextLockingDesc')}
              </p>
            </Link>
            <Link
              href="/tutorials/cache-layer"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialRate.nextCache')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialRate.nextCacheDesc')}
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
