import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, User, CheckCircle, ArrowRight, Zap, Database } from "lucide-react"
import Link from "next/link"

export default function CacheLayerTutorial() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/tutorials" className="text-yellow-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Tutorials
        </Link>
        <div className="flex items-center gap-4 mb-4">
          <Badge className="bg-yellow-100 text-yellow-800">Intermediate</Badge>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">25 min</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <User className="h-4 w-4" />
            <span className="text-sm">Some Redis experience needed</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Implementing a High-Performance Cache Layer</h1>
        <p className="text-xl text-gray-600">
          Create a robust caching layer to dramatically improve your application's performance by reducing database
          load and response times.
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
              <span>Cache-aside (lazy loading) pattern</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Cache invalidation strategies</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Cache warming and preloading</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Monitoring cache hit rates</span>
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
              <span>Basic understanding of caching concepts</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-600">•</span>
              <span>Familiarity with Redis data types</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-600">•</span>
              <span>Database knowledge (PostgreSQL, MySQL, etc.)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Step 1: Cache Manager Class */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              1
            </div>
            Create Cache Manager
          </CardTitle>
          <CardDescription>Build a flexible cache manager with multiple strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheManager {
  private client: SolidisFeaturedClient;
  private prefix: string;
  private defaultTTL: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: {
    host?: string;
    port?: number;
    prefix?: string;
    defaultTTL?: number;
  } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.prefix = options.prefix || 'cache:';
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  private getKey(key: string): string {
    return \`\${this.prefix}\${key}\`;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const cacheKey = this.getKey(key);
    const value = await this.client.get(cacheKey);

    if (value) {
      this.hits++;
      return JSON.parse(value.toString()) as T;
    }

    this.misses++;
    return null;
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.getKey(key);
    const ttl = options.ttl || this.defaultTTL;

    await this.client.set(
      cacheKey,
      JSON.stringify(value),
      { EX: ttl }
    );
  }

  /**
   * Cache-aside pattern: Get from cache or fetch from source
   */
  async getOrSet<T = any>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from source
    const value = await fetchFn();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const cacheKey = this.getKey(key);
    const result = await this.client.del(cacheKey);
    return result > 0;
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const keys: string[] = [];
    let cursor = 0;

    do {
      const result = await this.client.scan(
        cursor,
        { MATCH: \`\${this.prefix}\${pattern}\`, COUNT: 100 }
      );
      cursor = result[0];
      keys.push(...result[1].map((k: Buffer) => k.toString()));
    } while (cursor !== 0);

    if (keys.length === 0) {
      return 0;
    }

    return await this.client.del(...keys);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const cacheKey = this.getKey(key);
    const result = await this.client.exists(cacheKey);
    return result === 1;
  }

  /**
   * Extend TTL of existing key
   */
  async touch(key: string, ttl?: number): Promise<boolean> {
    const cacheKey = this.getKey(key);
    const expiry = ttl || this.defaultTTL;
    const result = await this.client.expire(cacheKey, expiry);
    return result === 1;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: hitRate.toFixed(2) + '%',
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Database Integration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              2
            </div>
            Integrate with Database
          </CardTitle>
          <CardDescription>Example with a user repository pattern</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`import { CacheManager } from './cache-manager';

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
}

export class UserRepository {
  private cache: CacheManager;
  private db: any; // Your database client

  constructor(cache: CacheManager, db: any) {
    this.cache = cache;
    this.db = db;
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId: string): Promise<User | null> {
    const cacheKey = \`user:\${userId}\`;

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        // Fetch from database
        const user = await this.db.query(
          'SELECT * FROM users WHERE id = $1',
          [userId]
        );
        return user.rows[0] || null;
      },
      { ttl: 300 } // 5 minutes
    );
  }

  /**
   * Get multiple users with batch caching
   */
  async getUsersByIds(userIds: string[]): Promise<User[]> {
    const users: User[] = [];
    const uncachedIds: string[] = [];

    // Check cache for each user
    for (const userId of userIds) {
      const cacheKey = \`user:\${userId}\`;
      const cached = await this.cache.get<User>(cacheKey);

      if (cached) {
        users.push(cached);
      } else {
        uncachedIds.push(userId);
      }
    }

    // Fetch uncached users from database
    if (uncachedIds.length > 0) {
      const result = await this.db.query(
        'SELECT * FROM users WHERE id = ANY($1)',
        [uncachedIds]
      );

      // Cache fetched users
      for (const user of result.rows) {
        users.push(user);
        await this.cache.set(
          \`user:\${user.id}\`,
          user,
          { ttl: 300 }
        );
      }
    }

    return users;
  }

  /**
   * Update user with cache invalidation
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    // Update database
    const result = await this.db.query(
      'UPDATE users SET username = $1, email = $2, name = $3 WHERE id = $4 RETURNING *',
      [data.username, data.email, data.name, userId]
    );

    const user = result.rows[0];

    // Invalidate cache
    await this.cache.delete(\`user:\${userId}\`);

    // Optionally: warm cache with new data
    await this.cache.set(\`user:\${userId}\`, user, { ttl: 300 });

    return user;
  }

  /**
   * Delete user with cache invalidation
   */
  async deleteUser(userId: string): Promise<boolean> {
    // Delete from database
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);

    // Invalidate cache
    await this.cache.delete(\`user:\${userId}\`);

    return true;
  }

  /**
   * Search users (with result caching)
   */
  async searchUsers(query: string): Promise<User[]> {
    const cacheKey = \`search:users:\${query}\`;

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const result = await this.db.query(
          'SELECT * FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 20',
          [\`%\${query}%\`]
        );
        return result.rows;
      },
      { ttl: 60 } // 1 minute (shorter for search results)
    );
  }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Cache Warming */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
              3
            </div>
            Cache Warming Strategy
          </CardTitle>
          <CardDescription>Preload frequently accessed data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`export class CacheWarmer {
  private cache: CacheManager;
  private db: any;

  constructor(cache: CacheManager, db: any) {
    this.cache = cache;
    this.db = db;
  }

  /**
   * Warm cache with popular users
   */
  async warmPopularUsers(limit: number = 100): Promise<void> {
    const result = await this.db.query(
      \`SELECT * FROM users
       ORDER BY last_login DESC
       LIMIT $1\`,
      [limit]
    );

    const promises = result.rows.map((user: User) =>
      this.cache.set(\`user:\${user.id}\`, user, { ttl: 3600 })
    );

    await Promise.all(promises);
    console.log(\`Warmed cache with \${result.rows.length} users\`);
  }

  /**
   * Warm cache with featured content
   */
  async warmFeaturedContent(): Promise<void> {
    const result = await this.db.query(
      'SELECT * FROM posts WHERE featured = true'
    );

    const promises = result.rows.map((post: any) =>
      this.cache.set(\`post:\${post.id}\`, post, { ttl: 7200 })
    );

    await Promise.all(promises);
    console.log(\`Warmed cache with \${result.rows.length} featured posts\`);
  }

  /**
   * Schedule periodic cache warming
   */
  startPeriodicWarming(intervalMs: number = 3600000): NodeJS.Timer {
    return setInterval(async () => {
      try {
        await this.warmPopularUsers();
        await this.warmFeaturedContent();
        console.log('Cache warming completed');
      } catch (error) {
        console.error('Cache warming failed:', error);
      }
    }, intervalMs);
  }
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
            Complete Usage Example
          </CardTitle>
          <CardDescription>Putting it all together in your application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`import express from 'express';
import { CacheManager } from './cache-manager';
import { UserRepository } from './user-repository';
import { CacheWarmer } from './cache-warmer';
import { Pool } from 'pg';

const app = express();
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const cache = new CacheManager({
  host: '127.0.0.1',
  port: 6379,
  prefix: 'myapp:',
  defaultTTL: 3600,
});

const userRepo = new UserRepository(cache, db);
const warmer = new CacheWarmer(cache, db);

app.use(express.json());

// Get user endpoint (with caching)
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userRepo.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user endpoint (with cache invalidation)
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await userRepo.updateUser(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users endpoint (with cached results)
app.get('/api/users/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const users = await userRepo.searchUsers(query);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cache stats endpoint
app.get('/api/cache/stats', (req, res) => {
  const stats = cache.getStats();
  res.json(stats);
});

// Start server
async function start() {
  await cache.connect();

  // Warm cache on startup
  await warmer.warmPopularUsers(100);
  await warmer.warmFeaturedContent();

  // Schedule periodic warming
  warmer.startPeriodicWarming(3600000); // Every hour

  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}

start().catch(console.error);`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Performance Optimization Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Use appropriate TTL values</div>
                <div className="text-sm text-gray-600">
                  Longer TTL for static data, shorter for frequently changing data
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Implement cache stampede protection</div>
                <div className="text-sm text-gray-600">Use locks to prevent multiple simultaneous cache misses</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Monitor cache hit rates</div>
                <div className="text-sm text-gray-600">Aim for 80%+ hit rate for optimal performance</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Use pipelining for batch operations</div>
                <div className="text-sm text-gray-600">Reduce network round trips when caching multiple items</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Implement tiered caching</div>
                <div className="text-sm text-gray-600">
                  Combine in-memory cache (Node.js) with Redis for maximum performance
                </div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Cache Invalidation Strategies */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-yellow-600" />
            Cache Invalidation Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold mb-1">Time-based (TTL)</h4>
              <p className="text-sm text-gray-600">Best for: Data that changes predictably over time</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold mb-1">Event-based</h4>
              <p className="text-sm text-gray-600">Best for: Data that changes based on user actions</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold mb-1">Pattern-based</h4>
              <p className="text-sm text-gray-600">Best for: Invalidating related cache entries</p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold mb-1">Write-through</h4>
              <p className="text-sm text-gray-600">Best for: Data consistency requirements</p>
            </div>
          </div>
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
              href="/tutorials/distributed-locking"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">Distributed Locking</h3>
              <p className="text-sm text-gray-600">Prevent race conditions in distributed systems</p>
            </Link>
            <Link href="/tutorials/job-queue" className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="font-semibold mb-2">Job Queue Implementation</h3>
              <p className="text-sm text-gray-600">Build a background job processing system</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
