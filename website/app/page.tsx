"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Book, Code, Zap, Shield, Users, Star, BarChart } from "lucide-react"
import { useGitHubStats } from "@/hooks/use-github-stats"
import { GitHubStats } from "@/components/github-stats"

export default function HomePage() {
  const { stats, loading } = useGitHubStats()
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-20 px-4">
        <div className="absolute inset-0 bg-[url('/grid.png')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/10"></div>
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center space-y-6">
            <Badge variant="secondary" className="mb-4">
              <Star className="w-4 h-4 mr-1" />
              {loading ? "Loading..." : `${stats.stars.toLocaleString()} GitHub Stars`}
              {stats.fallback && !loading && <span className="ml-1 text-xs opacity-75">(cached)</span>}
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Solidis
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
              High-performance, SOLID-structured RESP client for Redis and other RESP-compatible servers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold" asChild>
                <Link href="/getting-started">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                asChild
              >
                <Link href="/api-reference">View API Reference</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Solidis?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built with performance and reliability in mind, following SOLID principles for maintainable code.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Zap className="h-12 w-12 text-yellow-500 mb-4" />
                <CardTitle>High Performance</CardTitle>
                <CardDescription>
                  Optimized for speed with efficient connection pooling and minimal overhead
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-12 w-12 text-yellow-600 mb-4" />
                <CardTitle>SOLID Architecture</CardTitle>
                <CardDescription>
                  Clean, maintainable code following SOLID principles for better extensibility
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Code className="h-12 w-12 text-yellow-700 mb-4" />
                <CardTitle>TypeScript First</CardTitle>
                <CardDescription>
                  Full TypeScript support with comprehensive type definitions and IntelliSense
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benchmarks Section */}
      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-yellow-500 text-yellow-400">
              <BarChart className="w-4 h-4 mr-1" />
              Performance
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Blazing Fast Performance</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Solidis delivers up to 79% faster performance than IoRedis with zero dependencies
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-3 px-4 text-left">Benchmark</th>
                  <th className="py-3 px-4 text-center">Solidis</th>
                  <th className="py-3 px-4 text-center">IoRedis</th>
                  <th className="py-3 px-4 text-center">Speed Boost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <div className="font-medium">Hash</div>
                    <div className="text-xs text-gray-400">HSET + HGET + HGETALL</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-yellow-400">248.82ms</td>
                  <td className="py-3 px-4 text-center font-mono">446.03ms</td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded text-sm font-medium">
                      79% FASTER 🔥🔥
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <div className="font-medium">Set Operations</div>
                    <div className="text-xs text-gray-400">SADD + SISMEMBER + SREM</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-yellow-400">257.35ms</td>
                  <td className="py-3 px-4 text-center font-mono">444.08ms</td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded text-sm font-medium">
                      73% FASTER 🔥🔥
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <div className="font-medium">Expire</div>
                    <div className="text-xs text-gray-400">SET + EXPIRE + TTL</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-yellow-400">198.11ms</td>
                  <td className="py-3 px-4 text-center font-mono">339.78ms</td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded text-sm font-medium">
                      72% FASTER 🔥🔥
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <div className="font-medium">Non-Transaction</div>
                    <div className="text-xs text-gray-400">SET with EXPIRE + GET</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-yellow-400">259.69ms</td>
                  <td className="py-3 px-4 text-center font-mono">394.34ms</td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded text-sm font-medium">
                      52% FASTER 🔥
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 text-center">
            <Button variant="outline" className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20" asChild>
              <Link href="/benchmarks">View All Benchmarks</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Get Started in Minutes</h2>
              <p className="text-lg text-gray-600 mb-8">
                Install Solidis and start building high-performance Redis applications with just a few lines of code.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
                    1
                  </div>
                  <span>Install via npm or yarn</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
                    2
                  </div>
                  <span>Configure your Redis connection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
                    3
                  </div>
                  <span>Start building amazing applications</span>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Installation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  <div className="text-green-400"># Install Solidis</div>
                  <div className="mt-2">npm install @vcms-io/solidis</div>
                  <div className="mt-4 text-green-400"># Basic usage</div>
                  <div className="mt-2">
                    <div>import {"{ SolidisClient }"} from '@vcms-io/solidis';</div>
                    <div className="mt-1">const client = new SolidisClient();</div>
                    <div className="mt-1">await client.connect();</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* GitHub Statistics */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Community & Activity</h2>
            <p className="text-xl text-gray-600">
              Join our growing community of developers using Solidis in production
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <GitHubStats />
          </div>
        </div>
      </section>

      {/* Documentation Sections */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Comprehensive Documentation</h2>
            <p className="text-xl text-gray-600">Everything you need to master Solidis</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Book className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>Step-by-step guides for beginners and experienced developers</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/getting-started">Start Learning</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Code className="h-8 w-8 text-green-600 mb-2" />
                <CardTitle>API Reference</CardTitle>
                <CardDescription>Complete API documentation with examples and type definitions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/api-reference">Browse API</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Users className="h-8 w-8 text-purple-600 mb-2" />
                <CardTitle>Tutorials</CardTitle>
                <CardDescription>Learn by building real-world applications and use cases</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/tutorials">View Tutorials</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
