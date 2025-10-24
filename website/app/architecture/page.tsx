import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Layers, Zap, Database, Network, Code, Shield, ArrowRight } from "lucide-react"

export default function ArchitecturePage() {
  const components = [
    {
      name: "SolidisClient",
      icon: <Code className="h-8 w-8 text-yellow-600" />,
      description: "Core entry point that creates and coordinates all components",
      responsibilities: [
        "Component initialization and lifecycle management",
        "Configuration management",
        "Event coordination between components",
        "Extension system for custom commands",
      ],
    },
    {
      name: "Connection",
      icon: <Network className="h-8 w-8 text-blue-600" />,
      description: "Manages TCP/TLS socket connections",
      responsibilities: [
        "Socket connection establishment",
        "Automatic reconnection with exponential backoff",
        "TLS/SSL support",
        "Connection state management",
        "Auto-recovery for database selection and subscriptions",
      ],
    },
    {
      name: "Requester",
      icon: <Zap className="h-8 w-8 text-green-600" />,
      description: "Handles command pipelining and request states",
      responsibilities: [
        "Command queue management",
        "Pipeline optimization",
        "Request/response correlation",
        "Command timeout handling",
        "Transaction (MULTI/EXEC) coordination",
      ],
    },
    {
      name: "Parser",
      icon: <Database className="h-8 w-8 text-purple-600" />,
      description: "Processes RESP2/RESP3 protocol with optimized buffer handling",
      responsibilities: [
        "RESP protocol parsing (RESP2 and RESP3)",
        "Zero-copy buffer operations",
        "Efficient memory management",
        "Multi-byte character support",
        "Binary-safe data handling",
      ],
    },
    {
      name: "PubSub",
      icon: <Shield className="h-8 w-8 text-red-600" />,
      description: "Maintains subscription state for pub/sub functionality",
      responsibilities: [
        "Channel subscription management",
        "Pattern subscription support",
        "Message routing to event handlers",
        "Subscription state recovery after reconnection",
      ],
    },
    {
      name: "Debug Memory",
      icon: <Layers className="h-8 w-8 text-gray-600" />,
      description: "Centralized debug logging system",
      responsibilities: [
        "Debug event collection",
        "Circular buffer for memory efficiency",
        "Debug event filtering",
        "Performance metrics tracking",
      ],
    },
  ]

  const principles = [
    {
      title: "Single Responsibility",
      description: "Each component has a single, well-defined responsibility",
      example: "Parser only handles RESP protocol parsing, not connection management",
    },
    {
      title: "Open/Closed",
      description: "Open for extension, closed for modification via the extension system",
      example: "Add custom commands without modifying core client code",
    },
    {
      title: "Liskov Substitution",
      description: "Components can be replaced with alternative implementations",
      example: "Different parser implementations for RESP2 vs RESP3",
    },
    {
      title: "Interface Segregation",
      description: "Minimal, focused interfaces between components",
      example: "PubSub exposes only subscription-related methods",
    },
    {
      title: "Dependency Inversion",
      description: "Components depend on abstractions, not concrete implementations",
      example: "Client depends on parser interface, not specific parser implementation",
    },
  ]

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Architecture</h1>
        <p className="text-xl text-gray-600">
          Solidis follows SOLID principles to create a maintainable, extensible, and high-performance Redis client
          architecture.
        </p>
      </div>

      {/* Architecture Diagram */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-yellow-600" />
            System Architecture
          </CardTitle>
          <CardDescription>
            Overview of how Solidis components work together to provide a robust Redis client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-8 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-xs md:text-sm">{`
┌─────────────────────────────────────────────────┐
│                  SolidisClient                  │
│                                                 │
│      Creates & coordinates all components       │
│                                                 │
│     ┌────────────────────────────────────┐      │
│     │             Debug Memory           │      │
│     └───────┬───────────────────┬────────┘      │
│             ▼                   ▼               │
│     ┌────────────────┐  ┌────────────────┐      │
│     │   Connection   │─►│   Requester    │─┐    │
│     └────────────────┘  └────────────────┘ │    │
│                         ┌────────────────┐ │    │
│                         │     Parser     │◄┤    │
│                         └────────────────┘ │    │
│                         ┌────────────────┐ │    │
│                         │     PubSub     │◄┘    │
│                         └────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
         ┌──────────────┴─────────────┐
         ▼                            ▼
┌─────────────────┐       ┌───────────────────────┐
│ SolidisClient   │       │ SolidisFeaturedClient │
│ (needs extend)  │       │ (all commands)        │
└─────────────────┘       └───────────────────────┘
            `}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Components */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Core Components</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {components.map((component, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  {component.icon}
                  <CardTitle>{component.name}</CardTitle>
                </div>
                <CardDescription>{component.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold mb-2 text-sm">Key Responsibilities:</h4>
                <ul className="space-y-1">
                  {component.responsibilities.map((responsibility, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-yellow-600 mt-1">•</span>
                      <span className="text-gray-600">{responsibility}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* SOLID Principles */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6">SOLID Principles in Action</h2>
        <p className="text-gray-600 mb-6">
          Solidis is built following SOLID design principles, ensuring maintainability, testability, and extensibility.
        </p>
        <div className="space-y-4">
          {principles.map((principle, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {principle.title.charAt(0)}
                      </Badge>
                      {principle.title}
                    </CardTitle>
                    <CardDescription className="mt-2">{principle.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Example: </span>
                    {principle.example}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Data Flow */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-yellow-600" />
            Command Execution Flow
          </CardTitle>
          <CardDescription>How commands flow through the Solidis architecture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                1
              </div>
              <div>
                <div className="font-medium mb-1">Client receives command</div>
                <div className="text-sm text-gray-600">
                  User calls a command method (e.g., <code className="bg-gray-100 px-1 py-0.5 rounded">client.set('key', 'value')</code>)
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                2
              </div>
              <div>
                <div className="font-medium mb-1">Requester queues command</div>
                <div className="text-sm text-gray-600">
                  Command is added to the pipeline queue for batch processing
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                3
              </div>
              <div>
                <div className="font-medium mb-1">Connection sends data</div>
                <div className="text-sm text-gray-600">
                  Command is serialized to RESP protocol and sent through the TCP socket
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                4
              </div>
              <div>
                <div className="font-medium mb-1">Parser processes response</div>
                <div className="text-sm text-gray-600">
                  Parser reads and parses RESP response from Redis using zero-copy operations
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                5
              </div>
              <div>
                <div className="font-medium mb-1">Requester resolves promise</div>
                <div className="text-sm text-gray-600">
                  Parsed response is matched to the original command and the promise is resolved
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                6
              </div>
              <div>
                <div className="font-medium mb-1">Result returned to user</div>
                <div className="text-sm text-gray-600">
                  The parsed result is returned to the user's await statement
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Optimizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Performance Optimizations
          </CardTitle>
          <CardDescription>Key architectural decisions that make Solidis fast</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Zero-Copy Operations</h4>
              <p className="text-sm text-gray-600 mb-2">
                The parser uses buffer slicing instead of copying data, reducing memory allocations and improving
                throughput for large payloads.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Pipeline Batching</h4>
              <p className="text-sm text-gray-600 mb-2">
                Commands are automatically batched in pipelines to reduce network round trips, configurable via{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">maxCommandsPerPipeline</code>.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Efficient Buffer Management</h4>
              <p className="text-sm text-gray-600 mb-2">
                Smart buffer allocation and reuse strategies minimize garbage collection pressure and memory overhead.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Lazy Connections</h4>
              <p className="text-sm text-gray-600 mb-2">
                Optional lazy connection mode delays connection establishment until needed, reducing resource usage for
                idle clients.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
