import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, CheckCircle, ArrowRight, Lock } from "lucide-react"
import Link from "next/link"
import { CodeBlock } from '@/components/code-block'

export default function DistributedLockingTutorial() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-8">
        <Link href="/tutorials" className="text-yellow-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Tutorials
        </Link>
        <div className="flex items-center gap-4 mb-4">
          <Badge className="bg-red-100 text-red-800">Advanced</Badge>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">30 min</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Distributed Locking with Redis</h1>
        <p className="text-xl text-gray-600">
          Learn how to implement distributed locks to coordinate operations across multiple processes and servers.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What You'll Learn</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Simple distributed lock implementation</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>RedLock algorithm for fault tolerance</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Lock renewal and automatic release</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Preventing race conditions</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              1
            </div>
            Simple Distributed Lock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <CodeBlock code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';
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
      NX: true,
      EX: ttlSeconds,
    });

    return result === 'OK' ? value : null;
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

    const result = await this.client.eval(script, {
      keys: [key],
      arguments: [token],
    });

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

    const result = await this.client.eval(script, {
      keys: [key],
      arguments: [token, ttlSeconds.toString()],
    });

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
}`} language="typescript" showLineNumbers={true} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              2
            </div>
            Usage Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <CodeBlock code={`import { DistributedLock } from './distributed-lock';

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
}`} language="typescript" showLineNumbers={true} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-yellow-600" />
            RedLock Algorithm (Using Extensions)
          </CardTitle>
          <CardDescription>For production-grade distributed locking</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            For production use, consider using the{" "}
            <a
              href="https://github.com/vcms-io/solidis-extensions"
              className="text-yellow-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              @vcms-io/solidis-extensions
            </a>{" "}
            package which includes a battle-tested RedLock implementation.
          </p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
            npm install @vcms-io/solidis-extensions
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Always set appropriate TTL</div>
                <div className="text-sm text-gray-600">Prevent deadlocks from crashed processes</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Use unique lock tokens</div>
                <div className="text-sm text-gray-600">Prevent accidental lock release by other processes</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Implement lock renewal for long operations</div>
                <div className="text-sm text-gray-600">Extend TTL while work is in progress</div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-yellow-600" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/tutorials/job-queue" className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="font-semibold mb-2">Job Queue</h3>
              <p className="text-sm text-gray-600">Build a background job processing system</p>
            </Link>
            <Link href="/tutorials/cache-layer" className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="font-semibold mb-2">Cache Layer</h3>
              <p className="text-sm text-gray-600">Implement caching strategies</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
