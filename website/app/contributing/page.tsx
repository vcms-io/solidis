import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitBranch, Code, TestTube, FileText, Users, Star, AlertCircle } from "lucide-react"

export default function ContributingPage() {
  const contributionTypes = [
    {
      icon: <Code className="h-8 w-8 text-blue-600" />,
      title: "Code Contributions",
      description: "Fix bugs, add features, or improve performance",
      examples: ["Bug fixes", "New features", "Performance optimizations", "Refactoring"],
    },
    {
      icon: <FileText className="h-8 w-8 text-green-600" />,
      title: "Documentation",
      description: "Improve docs, add examples, or fix typos",
      examples: ["API documentation", "Tutorials", "Code examples", "Translations"],
    },
    {
      icon: <TestTube className="h-8 w-8 text-purple-600" />,
      title: "Testing",
      description: "Add tests or improve test coverage",
      examples: ["Unit tests", "Integration tests", "Performance tests", "Edge cases"],
    },
    {
      icon: <AlertCircle className="h-8 w-8 text-red-600" />,
      title: "Bug Reports",
      description: "Report issues with detailed information",
      examples: ["Bug reports", "Feature requests", "Performance issues", "Security concerns"],
    },
  ]

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Contributing to Solidis</h1>
        <p className="text-xl text-gray-600">
          Solidis is an open-source project and we welcome contributions from the community. Here's how you can help
          make Solidis better.
        </p>
      </div>

      {/* Ways to Contribute */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Ways to Contribute</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {contributionTypes.map((type, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  {type.icon}
                  <CardTitle>{type.title}</CardTitle>
                </div>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {type.examples.map((example, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {example}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-yellow-600" />
            Development Setup
          </CardTitle>
          <CardDescription>Setting up your development environment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">1. Fork and Clone</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                <div className="text-green-400"># Fork the repository on GitHub first</div>
                <div>git clone https://github.com/YOUR_USERNAME/solidis.git</div>
                <div>cd solidis</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">2. Install Dependencies</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                <div className="text-green-400"># Install all dependencies</div>
                <div>npm install</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">3. Build the Project</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                <div className="text-green-400"># Build the TypeScript code</div>
                <div>npm run build</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">4. Run Tests</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                <div className="text-green-400"># Make sure all tests pass</div>
                <div>npm test</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Development Workflow */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-yellow-600" />
            Development Workflow
          </CardTitle>
          <CardDescription>Step-by-step guide to making contributions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                1
              </div>
              <div>
                <div className="font-medium mb-1">Create a Feature Branch</div>
                <div className="text-sm text-gray-600 mb-2">
                  Create a new branch for your feature or bug fix
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                  git checkout -b feature/your-feature-name
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                2
              </div>
              <div>
                <div className="font-medium mb-1">Make Your Changes</div>
                <div className="text-sm text-gray-600">
                  Follow the code style guidelines and write tests for your changes
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                3
              </div>
              <div>
                <div className="font-medium mb-1">Test Your Changes</div>
                <div className="text-sm text-gray-600 mb-2">Ensure all tests pass and add new tests if needed</div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                  npm test
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                4
              </div>
              <div>
                <div className="font-medium mb-1">Commit Your Changes</div>
                <div className="text-sm text-gray-600 mb-2">
                  Write clear, descriptive commit messages
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                  <div>git add .</div>
                  <div>git commit -m "feat: add new feature"</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold shrink-0">
                5
              </div>
              <div>
                <div className="font-medium mb-1">Push and Create Pull Request</div>
                <div className="text-sm text-gray-600 mb-2">Push your branch and create a pull request</div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                  <div>git push origin feature/your-feature-name</div>
                  <div className="mt-2 text-green-400"># Then create a PR on GitHub</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Quality Guidelines */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-600" />
            Code Quality Guidelines
          </CardTitle>
          <CardDescription>Standards to follow when contributing code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold mb-2">TypeScript Best Practices</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Use strict typing and avoid <code className="bg-gray-100 px-1 py-0.5 rounded">any</code> types where possible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Avoid type casting with <code className="bg-gray-100 px-1 py-0.5 rounded">as</code> unless absolutely necessary</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Provide comprehensive type definitions for all public APIs</span>
                </li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold mb-2">Performance Considerations</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Consider performance implications of your changes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Avoid unnecessary allocations and copying</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Use benchmarks to validate performance improvements</span>
                </li>
              </ul>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold mb-2">Dependencies</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Avoid adding new dependencies unless absolutely necessary</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Keep the bundle size minimal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Justify any new dependencies in your PR description</span>
                </li>
              </ul>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold mb-2">Testing</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>Write tests for all new features and bug fixes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>Ensure existing tests continue to pass</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>Include edge cases and error scenarios in tests</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pull Request Guidelines */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-yellow-600" />
            Pull Request Guidelines
          </CardTitle>
          <CardDescription>What to include in your pull request</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">PR Description</h4>
              <p className="text-sm text-gray-600 mb-2">
                Provide a clear description of the changes and their purpose:
              </p>
              <ul className="space-y-1 text-sm text-gray-600 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>What problem does this solve?</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>How does it solve the problem?</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Are there any breaking changes?</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Reference any related issues</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Documentation</h4>
              <p className="text-sm text-gray-600">
                Update documentation to reflect your changes, including README, API docs, and code comments.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Commit Messages</h4>
              <p className="text-sm text-gray-600 mb-2">Follow conventional commit format:</p>
              <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                <div>feat: add new feature</div>
                <div>fix: resolve bug in parser</div>
                <div>docs: update API reference</div>
                <div>test: add integration tests</div>
                <div>perf: improve connection pooling</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Community */}
      <Card>
        <CardHeader>
          <CardTitle>Join the Community</CardTitle>
          <CardDescription>Connect with other contributors and get help</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="https://github.com/vcms-io/solidis/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">GitHub Issues</h3>
              <p className="text-sm text-gray-600">Report bugs and request features</p>
            </a>
            <a
              href="https://github.com/vcms-io/solidis/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">Discussions</h3>
              <p className="text-sm text-gray-600">Ask questions and share ideas</p>
            </a>
            <a
              href="https://github.com/vcms-io/solidis/pulls"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold mb-2">Pull Requests</h3>
              <p className="text-sm text-gray-600">Review and contribute code</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
