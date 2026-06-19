'use client';

import { BarChart, Clock, Cpu, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/lib/i18n-context';

export default function BenchmarksPage() {
  const { t } = useI18n();

  const benchmarkData = [
    {
      name: 'Set Mutation',
      description: 'SADD + SISMEMBER + SREM',
      solidis: '1772ms',
      ioredis: '3617ms',
      improvement: '2.0x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'List Range',
      description: 'LPUSH + RPUSH + LRANGE',
      solidis: '1854ms',
      ioredis: '3701ms',
      improvement: '2.0x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'List Mutation',
      description: 'LPUSH + RPUSH + LPOP + RPOP + LLEN',
      solidis: '2567ms',
      ioredis: '5002ms',
      improvement: '1.9x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Sorted Set',
      description: 'ZADD + ZRANGE + ZREM',
      solidis: '1692ms',
      ioredis: '3278ms',
      improvement: '1.9x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Multi-Key',
      description: 'MSET + MGET',
      solidis: '1602ms',
      ioredis: '3049ms',
      improvement: '1.9x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Hash Mutation',
      description: 'HMSET + HMGET + HDEL',
      solidis: '1522ms',
      ioredis: '2837ms',
      improvement: '1.9x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Set',
      description: 'SET',
      solidis: '746ms',
      ioredis: '1365ms',
      improvement: '1.8x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Set Read',
      description: 'SADD + SISMEMBER + SMEMBERS',
      solidis: '1799ms',
      ioredis: '3295ms',
      improvement: '1.8x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Expire',
      description: 'SET + EXPIRE + TTL',
      solidis: '1445ms',
      ioredis: '2559ms',
      improvement: '1.8x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Stream',
      description: 'XADD + XRANGE + XLEN',
      solidis: '1496ms',
      ioredis: '2622ms',
      improvement: '1.8x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Non-Transaction',
      description: 'SET with PX + GET',
      solidis: '1255ms',
      ioredis: '2141ms',
      improvement: '1.7x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Pipeline Mixed',
      description: 'SET + INCR + GET',
      solidis: '1616ms',
      ioredis: '2631ms',
      improvement: '1.6x FASTER',
      level: '🔥🔥',
    },
    {
      name: 'Counter',
      description: 'INCR + DECR',
      solidis: '922ms',
      ioredis: '1415ms',
      improvement: '1.5x FASTER',
      level: '🔥',
    },
    {
      name: 'Hash Round-Trip',
      description: 'HSET + HGET + HGETALL',
      solidis: '1810ms',
      ioredis: '2734ms',
      improvement: '1.5x FASTER',
      level: '🔥',
    },
    {
      name: 'Get Buffer',
      description: 'GETBUFFER',
      solidis: '618ms',
      ioredis: '916ms',
      improvement: '1.5x FASTER',
      level: '🔥',
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{t('benchmarks.title')}</h1>
        <p className="text-xl text-gray-600">{t('benchmarks.subtitle')}</p>
      </div>

      {/* Benchmark Methodology */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-yellow-600" />
            Benchmark Methodology
          </CardTitle>
          <CardDescription>
            100,000 iterations × 10,000 concurrent commands × 10 repeats, 1 KB
            payload per request, autopipeline mode
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <div className="font-semibold">Repeats</div>
                <div className="text-sm text-gray-600">
                  10 repeats per benchmark, median elapsed
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="h-8 w-8 text-green-500" />
              <div>
                <div className="font-semibold">Concurrency</div>
                <div className="text-sm text-gray-600">
                  10,000 concurrent commands
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="font-semibold">Iterations</div>
                <div className="text-sm text-gray-600">
                  100,000 iterations per benchmark
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card className="mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <Zap className="h-5 w-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">
                2.0x
              </div>
              <div className="text-sm font-medium">Maximum Speed Boost</div>
              <div className="text-xs text-gray-600">
                Set Mutation / List Range
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">0</div>
              <div className="text-sm font-medium">Dependencies</div>
              <div className="text-xs text-gray-600">Pure implementation</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">
                {'<29KB'}
              </div>
              <div className="text-sm font-medium">Bundle Size</div>
              <div className="text-xs text-gray-600">Minimal footprint</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Benchmark Results</CardTitle>
          <CardDescription>
            Solidis vs ioredis performance comparison across different Redis
            operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-4 text-left font-semibold">
                    Benchmark
                  </th>
                  <th className="py-3 px-4 text-center font-semibold">
                    Solidis
                  </th>
                  <th className="py-3 px-4 text-center font-semibold">
                    ioredis
                  </th>
                  <th className="py-3 px-4 text-center font-semibold">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody>
                {benchmarkData.map((benchmark, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium">{benchmark.name}</div>
                      <div className="text-sm text-gray-600">
                        {benchmark.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-yellow-600 font-semibold">
                        {benchmark.solidis}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-gray-600">
                        {benchmark.ioredis}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800 font-medium"
                      >
                        {benchmark.improvement} {benchmark.level}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Key Features */}
      <div className="mt-12 grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Why Solidis is Faster</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">Zero Dependencies</div>
                  <div className="text-sm text-gray-600">
                    No overhead from external libraries, pure Node.js
                    implementation
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">Zero-Copy RESP Parser</div>
                  <div className="text-sm text-gray-600">
                    Buffer slices without copying, intelligent shift thresholds
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">
                    setImmediate Pipeline Coalescing
                  </div>
                  <div className="text-sm text-gray-600">
                    Commands batched within the same tick for fewer round trips
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">Chunked Socket Writes</div>
                  <div className="text-sm text-gray-600">
                    Backpressure-aware writes with configurable chunk sizes
                  </div>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex justify-between">
                <span className="text-gray-600">Node.js Version:</span>
                <span className="font-mono">v22.22.3</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Redis Version:</span>
                <span className="font-mono">7.0+</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Platform:</span>
                <span className="font-mono">Linux x64</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Mode:</span>
                <span className="font-mono">autopipeline</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Isolation:</span>
                <span className="font-mono">Worker threads</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Network:</span>
                <span className="font-mono">localhost</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="mt-12 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Experience the Speed?
          </h2>
          <p className="text-lg mb-6 opacity-90">
            Join thousands of developers who have already upgraded to Solidis
            for better performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/getting-started"
              className="bg-white text-yellow-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Get Started Now
            </a>
            <a
              href="https://github.com/vcms-io/solidis"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-yellow-600 transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
