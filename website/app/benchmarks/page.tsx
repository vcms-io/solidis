"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap, BarChart, Clock, Cpu } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

export default function BenchmarksPage() {
  const { t } = useI18n()

  const benchmarkData = [
    {
      name: "Hash",
      description: "HSET + HGET + HGETALL",
      solidis: "248.82ms",
      ioredis: "446.03ms",
      improvement: "79% FASTER",
      level: "🔥🔥",
    },
    {
      name: "Set Operations",
      description: "SADD + SISMEMBER + SREM",
      solidis: "257.35ms",
      ioredis: "444.08ms",
      improvement: "73% FASTER",
      level: "🔥🔥",
    },
    {
      name: "Expire",
      description: "SET + EXPIRE + TTL",
      solidis: "198.11ms",
      ioredis: "339.78ms",
      improvement: "72% FASTER",
      level: "🔥🔥",
    },
    {
      name: "Non-Transaction",
      description: "SET with EXPIRE + GET",
      solidis: "259.69ms",
      ioredis: "394.34ms",
      improvement: "52% FASTER",
      level: "🔥",
    },
    {
      name: "List",
      description: "LPUSH + RPUSH + LRANGE",
      solidis: "219.76ms",
      ioredis: "345.48ms",
      improvement: "57% FASTER",
      level: "🔥",
    },
    {
      name: "Counter",
      description: "INCR + DECR",
      solidis: "174.04ms",
      ioredis: "258.71ms",
      improvement: "49% FASTER",
      level: "🔥",
    },
    {
      name: "List operations",
      description: "LPUSH + RPUSH + LPOP + RPOP + LLEN",
      solidis: "396.67ms",
      ioredis: "587.16ms",
      improvement: "48% FASTER",
      level: "🔥",
    },
    {
      name: "Transaction + Non-Transaction",
      description: "SET + GET",
      solidis: "435.46ms",
      ioredis: "574.26ms",
      improvement: "32% FASTER",
      level: "⚡️",
    },
    {
      name: "Multi-key",
      description: "MSET + MGET",
      solidis: "393.87ms",
      ioredis: "437.45ms",
      improvement: "11% FASTER",
      level: "⚡️",
    },
    {
      name: "Transaction",
      description: "SET with EXPIRE + GET",
      solidis: "286.75ms",
      ioredis: "328.00ms",
      improvement: "14% FASTER",
      level: "⚡️",
    },
    {
      name: "Set",
      description: "SADD + SISMEMBER + SMEMBERS",
      solidis: "260.66ms",
      ioredis: "275.27ms",
      improvement: "6% FASTER",
      level: "⚡️",
    },
    {
      name: "Hash operations",
      description: "HMSET + HMGET + HDEL",
      solidis: "360.69ms",
      ioredis: "377.32ms",
      improvement: "5% FASTER",
      level: "⚡️",
    },
  ]

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{t("benchmarks.title")}</h1>
        <p className="text-xl text-gray-600">
          {t("benchmarks.subtitle")}
        </p>
      </div>

      {/* Benchmark Methodology */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-yellow-600" />
            Benchmark Methodology
          </CardTitle>
          <CardDescription>
            1000 concurrent commands × 10 iterations, 1 KB random-string payload per request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <div className="font-semibold">Test Duration</div>
                <div className="text-sm text-gray-600">10 iterations per benchmark</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Cpu className="h-8 w-8 text-green-500" />
              <div>
                <div className="font-semibold">Concurrency</div>
                <div className="text-sm text-gray-600">1000 concurrent commands</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="font-semibold">Payload Size</div>
                <div className="text-sm text-gray-600">1 KB random string data</div>
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
              <div className="text-3xl font-bold text-yellow-600 mb-2">79%</div>
              <div className="text-sm font-medium">Maximum Speed Boost</div>
              <div className="text-xs text-gray-600">Hash operations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">0</div>
              <div className="text-sm font-medium">Dependencies</div>
              <div className="text-xs text-gray-600">Pure implementation</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">{"<30KB"}</div>
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
          <CardDescription>Solidis vs IoRedis performance comparison across different Redis operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-4 text-left font-semibold">Benchmark</th>
                  <th className="py-3 px-4 text-center font-semibold">Solidis</th>
                  <th className="py-3 px-4 text-center font-semibold">IoRedis</th>
                  <th className="py-3 px-4 text-center font-semibold">Performance</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkData.map((benchmark, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{benchmark.name}</div>
                      <div className="text-sm text-gray-600">{benchmark.description}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-yellow-600 font-semibold">{benchmark.solidis}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-gray-600">{benchmark.ioredis}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 font-medium">
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
                  <div className="text-sm text-gray-600">No overhead from external libraries</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">Optimized Parser</div>
                  <div className="text-sm text-gray-600">Custom RESP protocol implementation</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">Efficient Memory Management</div>
                  <div className="text-sm text-gray-600">Zero-copy buffer operations</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <div>
                  <div className="font-medium">Smart Connection Pooling</div>
                  <div className="text-sm text-gray-600">Intelligent connection management</div>
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
                <span className="font-mono">v22.0.0</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Redis Version:</span>
                <span className="font-mono">7.0.11</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Platform:</span>
                <span className="font-mono">Linux x64</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">CPU:</span>
                <span className="font-mono">Intel Xeon</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Memory:</span>
                <span className="font-mono">16GB RAM</span>
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
          <h2 className="text-2xl font-bold mb-4">Ready to Experience the Speed?</h2>
          <p className="text-lg mb-6 opacity-90">
            Join thousands of developers who have already upgraded to Solidis for better performance.
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
  )
}
