import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, CheckCircle, ArrowRight, Layers } from "lucide-react"
import Link from "next/link"
import { CodeBlock } from '@/components/code-block'

export default function JobQueueTutorial() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-8">
        <Link href="/tutorials" className="text-yellow-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Tutorials
        </Link>
        <div className="flex items-center gap-4 mb-4">
          <Badge className="bg-yellow-100 text-yellow-800">Intermediate</Badge>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">35 min</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Building a Job Queue System</h1>
        <p className="text-xl text-gray-600">
          Create a robust background job processing system using Redis lists for reliable task execution.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What You'll Build</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Priority-based job queue</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Multiple worker support</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Job retry mechanism</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span>Dead letter queue for failed jobs</span>
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
            Job Queue Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <CodeBlock code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';
import { v4 as uuidv4 } from 'uuid';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  processedAt?: number;
}

export class JobQueue {
  private client: SolidisFeaturedClient;
  private queueName: string;
  private processingName: string;
  private deadLetterName: string;

  constructor(options: { host?: string; port?: number; queueName?: string } = {}) {
    this.client = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });
    this.queueName = options.queueName || 'jobs';
    this.processingName = \`\${this.queueName}:processing\`;
    this.deadLetterName = \`\${this.queueName}:dead\`;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Add a job to the queue
   */
  async addJob<T>(
    type: string,
    data: T,
    options: { priority?: number; maxAttempts?: number } = {}
  ): Promise<string> {
    const job: Job<T> = {
      id: uuidv4(),
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: Date.now(),
    };

    // Add to sorted set with priority as score (higher = more priority)
    await this.client.zadd(
      this.queueName,
      -job.priority, // Negative for descending order
      JSON.stringify(job)
    );

    return job.id;
  }

  /**
   * Get next job from queue
   */
  async getNextJob(): Promise<Job | null> {
    // Get highest priority job
    const jobs = await this.client.zpopmax(this.queueName);

    if (jobs.length === 0) {
      return null;
    }

    const job = JSON.parse(jobs[0].toString()) as Job;

    // Move to processing queue
    await this.client.hset(this.processingName, job.id, JSON.stringify(job));

    return job;
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string): Promise<void> {
    await this.client.hdel(this.processingName, jobId);
  }

  /**
   * Fail a job (retry or move to dead letter)
   */
  async failJob(jobId: string, error: string): Promise<void> {
    const jobData = await this.client.hget(this.processingName, jobId);

    if (!jobData) {
      return;
    }

    const job = JSON.parse(jobData.toString()) as Job;
    job.attempts++;

    if (job.attempts >= job.maxAttempts) {
      // Move to dead letter queue
      await this.client.lpush(
        this.deadLetterName,
        JSON.stringify({ ...job, error })
      );
      await this.client.hdel(this.processingName, jobId);
    } else {
      // Retry: move back to main queue
      await this.client.zadd(
        this.queueName,
        -job.priority,
        JSON.stringify(job)
      );
      await this.client.hdel(this.processingName, jobId);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const waiting = await this.client.zcard(this.queueName);
    const processing = await this.client.hlen(this.processingName);
    const dead = await this.client.llen(this.deadLetterName);

    return { waiting, processing, dead };
  }

  /**
   * Clear dead letter queue
   */
  async clearDeadLetters(): Promise<number> {
    const length = await this.client.llen(this.deadLetterName);
    if (length > 0) {
      await this.client.del(this.deadLetterName);
    }
    return length;
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
            Job Worker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <CodeBlock code={`import { JobQueue, Job } from './job-queue';

type JobHandler<T = any> = (data: T) => Promise<void>;

export class JobWorker {
  private queue: JobQueue;
  private handlers: Map<string, JobHandler>;
  private running: boolean = false;
  private pollInterval: number;

  constructor(queue: JobQueue, pollInterval: number = 1000) {
    this.queue = queue;
    this.handlers = new Map();
    this.pollInterval = pollInterval;
  }

  /**
   * Register a job handler
   */
  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Start processing jobs
   */
  async start(): Promise<void> {
    this.running = true;
    console.log('Worker started');

    while (this.running) {
      try {
        const job = await this.queue.getNextJob();

        if (job) {
          await this.processJob(job);
        } else {
          // No jobs available, wait before polling again
          await new Promise((resolve) =>
            setTimeout(resolve, this.pollInterval)
          );
        }
      } catch (error) {
        console.error('Worker error:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.running = false;
    console.log('Worker stopped');
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      console.error(\`No handler for job type: \${job.type}\`);
      await this.queue.failJob(
        job.id,
        \`No handler registered for type: \${job.type}\`
      );
      return;
    }

    try {
      console.log(\`Processing job \${job.id} (type: \${job.type})\`);
      await handler(job.data);
      await this.queue.completeJob(job.id);
      console.log(\`Completed job \${job.id}\`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(\`Failed job \${job.id}:\`, message);
      await this.queue.failJob(job.id, message);
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
              3
            </div>
            Usage Example
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <CodeBlock code={`import { JobQueue } from './job-queue';
import { JobWorker } from './job-worker';

// Create queue
const queue = new JobQueue({
  host: '127.0.0.1',
  port: 6379,
  queueName: 'myapp:jobs',
});

await queue.connect();

// Create worker
const worker = new JobWorker(queue);

// Register job handlers
worker.register('send-email', async (data: { to: string; subject: string }) => {
  console.log(\`Sending email to \${data.to}\`);
  await sendEmail(data.to, data.subject);
});

worker.register('process-image', async (data: { url: string }) => {
  console.log(\`Processing image: \${data.url}\`);
  await processImage(data.url);
});

worker.register('generate-report', async (data: { userId: string }) => {
  console.log(\`Generating report for user \${data.userId}\`);
  await generateReport(data.userId);
});

// Start worker
worker.start();

// Add jobs from your application
await queue.addJob('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
}, { priority: 5 });

await queue.addJob('process-image', {
  url: 'https://example.com/image.jpg',
}, { priority: 3 });

await queue.addJob('generate-report', {
  userId: '123',
}, { priority: 1, maxAttempts: 5 });

// Get queue stats
const stats = await queue.getStats();
console.log('Queue stats:', stats);

// Graceful shutdown
process.on('SIGTERM', () => {
  worker.stop();
});`} language="typescript" showLineNumbers={true} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-yellow-600" />
            Advanced Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Delayed Jobs</div>
                <div className="text-sm text-gray-600">Schedule jobs to run at a specific time</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Job Progress Tracking</div>
                <div className="text-sm text-gray-600">Update and monitor job progress in real-time</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Multiple Workers</div>
                <div className="text-sm text-gray-600">Scale horizontally by running multiple worker processes</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <div>
                <div className="font-medium">Job Deduplication</div>
                <div className="text-sm text-gray-600">Prevent duplicate jobs from being queued</div>
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
            <Link
              href="/tutorials/distributed-locking"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">Distributed Locking</h3>
              <p className="text-sm text-gray-600">Prevent race conditions in job processing</p>
            </Link>
            <Link href="/tutorials/cache-layer" className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="font-semibold mb-2">Cache Layer</h3>
              <p className="text-sm text-gray-600">Cache job results for better performance</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
