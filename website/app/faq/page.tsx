import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { HelpCircle, Zap, Shield, Code } from "lucide-react"

export default function FaqPage() {
  const categories = [
    {
      title: "Getting Started",
      icon: <HelpCircle className="h-5 w-5 text-yellow-600" />,
      questions: [
        {
          question: "What is Solidis and how is it different from other Redis clients?",
          answer:
            "Solidis is a high-performance RESP client built with SOLID principles in mind. It offers better type safety, connection pooling, and follows clean architecture patterns compared to traditional Redis clients. It's designed for modern TypeScript applications with a focus on maintainability and performance.",
        },
        {
          question: "Which Redis versions are supported?",
          answer:
            "Solidis supports Redis 5.0 and above, as well as any RESP-compatible server including Redis Cluster, Redis Sentinel, and cloud Redis services like AWS ElastiCache and Azure Cache for Redis.",
        },
        {
          question: "Can I use Solidis in production?",
          answer:
            "Yes! Solidis is production-ready and has been tested in high-traffic environments. It includes features like connection pooling, automatic reconnection, and comprehensive error handling to ensure reliability in production deployments.",
        },
      ],
    },
    {
      title: "Performance",
      icon: <Zap className="h-5 w-5 text-yellow-600" />,
      questions: [
        {
          question: "How does Solidis handle connection pooling?",
          answer:
            "Solidis includes built-in connection pooling that automatically manages multiple connections to Redis. You can configure the minimum and maximum number of connections, and the client will efficiently distribute commands across available connections to maximize throughput.",
        },
        {
          question: "What's the performance compared to other Redis clients?",
          answer:
            "Solidis is optimized for high throughput and low latency. Benchmarks show it performs comparably to or better than popular Redis clients like ioredis, with the added benefits of better TypeScript support and cleaner architecture.",
        },
        {
          question: "Does Solidis support pipelining?",
          answer:
            "Yes, Solidis supports command pipelining to batch multiple commands and reduce network round trips. This can significantly improve performance when executing multiple Redis operations.",
        },
      ],
    },
    {
      title: "Configuration",
      icon: <Code className="h-5 w-5 text-yellow-600" />,
      questions: [
        {
          question: "How do I configure connection timeouts?",
          answer:
            "You can configure both connection and command timeouts when creating a SolidisClient instance. Use the `connectTimeout` option for connection establishment timeout and `commandTimeout` for individual command execution timeout.",
        },
        {
          question: "Can I use Solidis with Redis Cluster?",
          answer:
            "Yes, Solidis supports Redis Cluster mode. Simply provide the cluster endpoints in your configuration, and the client will automatically handle cluster topology discovery and command routing.",
        },
        {
          question: "How do I handle authentication?",
          answer:
            "Set the `password` option in your SolidisClient configuration. For Redis 6+ with ACL users, you can also specify the `username` option along with the password.",
        },
      ],
    },
    {
      title: "Troubleshooting",
      icon: <Shield className="h-5 w-5 text-red-600" />,
      questions: [
        {
          question: "How do I handle connection errors?",
          answer:
            "Solidis provides comprehensive error handling with specific error types. You can catch connection errors and implement retry logic. The client also supports automatic reconnection with configurable retry attempts and delays.",
        },
        {
          question: "Why am I getting timeout errors?",
          answer:
            "Timeout errors can occur due to network issues, Redis server overload, or misconfigured timeout values. Check your `connectTimeout` and `commandTimeout` settings, and ensure your Redis server is responsive. Consider increasing timeout values for slow operations.",
        },
        {
          question: "How do I debug connection issues?",
          answer:
            "Enable debug logging by setting the appropriate log level in your configuration. Solidis provides detailed logging for connection events, command execution, and errors to help diagnose issues.",
        },
      ],
    },
  ]

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-xl text-gray-600">
          Find quick answers to common questions about Solidis. Can't find what you're looking for?
          <a href="https://github.com/vcms-io/solidis/discussions" className="text-yellow-600 hover:underline ml-1">
            Ask on GitHub Discussions
          </a>
        </p>
      </div>

      <div className="space-y-8">
        {categories.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {category.icon}
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {category.questions.map((item, index) => (
                  <AccordionItem key={index} value={`item-${categoryIndex}-${index}`}>
                    <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-gray-600">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contact Section */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Still Need Help?</CardTitle>
          <CardDescription>
            If you can't find the answer you're looking for, here are some ways to get help
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">GitHub Issues</h3>
              <p className="text-sm text-gray-600 mb-3">Report bugs or request features</p>
              <Badge variant="outline">Bug Reports</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">GitHub Discussions</h3>
              <p className="text-sm text-gray-600 mb-3">Ask questions and get community help</p>
              <Badge variant="outline">Community Support</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Documentation</h3>
              <p className="text-sm text-gray-600 mb-3">Comprehensive guides and API reference</p>
              <Badge variant="outline">Self-Service</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
