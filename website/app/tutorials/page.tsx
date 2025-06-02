import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, ArrowRight } from "lucide-react"

export default function TutorialsPage() {
  const tutorials = [
    {
      title: "Building a Session Store",
      description: "Learn how to implement a Redis-based session store for web applications using Solidis.",
      difficulty: "Beginner",
      duration: "15 min",
      tags: ["sessions", "web", "authentication"],
      href: "/tutorials/session-store",
    },
    {
      title: "Implementing a Cache Layer",
      description: "Create a high-performance caching layer to speed up your application's database queries.",
      difficulty: "Intermediate",
      duration: "25 min",
      tags: ["caching", "performance", "database"],
      href: "/tutorials/cache-layer",
    },
    {
      title: "Real-time Chat Application",
      description: "Build a real-time chat application using Redis pub/sub with Solidis and WebSockets.",
      difficulty: "Advanced",
      duration: "45 min",
      tags: ["pubsub", "realtime", "websockets"],
      href: "/tutorials/chat-app",
    },
    {
      title: "Rate Limiting with Redis",
      description: "Implement various rate limiting strategies using Redis and Solidis for API protection.",
      difficulty: "Intermediate",
      duration: "20 min",
      tags: ["rate-limiting", "api", "security"],
      href: "/tutorials/rate-limiting",
    },
    {
      title: "Distributed Locking",
      description: "Learn how to implement distributed locks using Redis to coordinate between multiple processes.",
      difficulty: "Advanced",
      duration: "30 min",
      tags: ["locking", "distributed", "concurrency"],
      href: "/tutorials/distributed-locking",
    },
    {
      title: "Job Queue Implementation",
      description: "Create a robust job queue system using Redis lists and Solidis for background processing.",
      difficulty: "Intermediate",
      duration: "35 min",
      tags: ["queues", "jobs", "background"],
      href: "/tutorials/job-queue",
    },
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-100 text-green-800"
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800"
      case "Advanced":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Tutorials & Use Cases</h1>
        <p className="text-xl text-gray-600">
          Learn Solidis through practical examples and real-world use cases. Each tutorial includes complete code
          examples and explanations.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorials.map((tutorial, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow group">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <Badge className={getDifficultyColor(tutorial.difficulty)}>{tutorial.difficulty}</Badge>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  {tutorial.duration}
                </div>
              </div>
              <CardTitle className="group-hover:text-yellow-600 transition-colors">{tutorial.title}</CardTitle>
              <CardDescription>{tutorial.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {tutorial.tags.map((tag, tagIndex) => (
                  <Badge key={tagIndex} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Link
                href={tutorial.href}
                className="inline-flex items-center text-yellow-600 hover:text-yellow-800 font-medium text-sm"
              >
                Start Tutorial
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Learning Path */}
      <div className="mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Recommended Learning Path
            </CardTitle>
            <CardDescription>Follow this path to master Solidis from basics to advanced concepts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-semibold">
                  1
                </div>
                <div>
                  <div className="font-medium">Start with Getting Started Guide</div>
                  <div className="text-sm text-gray-600">Learn the basics of installation and configuration</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
                  2
                </div>
                <div>
                  <div className="font-medium">Build a Session Store</div>
                  <div className="text-sm text-gray-600">Practice with a common real-world use case</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center text-yellow-800 font-semibold">
                  3
                </div>
                <div>
                  <div className="font-medium">Implement Caching</div>
                  <div className="text-sm text-gray-600">Learn performance optimization techniques</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 font-semibold">
                  4
                </div>
                <div>
                  <div className="font-medium">Advanced Patterns</div>
                  <div className="text-sm text-gray-600">Explore distributed locking, pub/sub, and job queues</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
