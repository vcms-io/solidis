"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Tag, Star, ExternalLink, User, Clock, Wifi, WifiOff } from "lucide-react"
import { useGitHubReleases } from "@/hooks/use-github-releases"
import ReactMarkdown from "react-markdown"
import { useI18n } from "@/lib/i18n-context"

export default function UpdatesPage() {
  const { t } = useI18n()
  const { releases, loading, error, fallback } = useGitHubReleases()

  const upcomingFeatures = [
    {
      title: "Redis Modules Support",
      description: "Native support for popular Redis modules like RedisJSON, RedisSearch, and RedisTimeSeries",
      status: "In Development",
    },
    {
      title: "Metrics and Monitoring",
      description: "Built-in metrics collection and monitoring capabilities for production deployments",
      status: "Planned",
    },
    {
      title: "Advanced Caching Patterns",
      description: "Higher-level abstractions for common caching patterns and strategies",
      status: "Research",
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Development":
        return "bg-blue-100 text-blue-800"
      case "Planned":
        return "bg-purple-100 text-purple-800"
      case "Research":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const parseChangelog = (body: string) => {
    // Extract bullet points from markdown
    const lines = body.split("\n")
    const changes: string[] = []

    for (const line of lines) {
      if (line.trim().startsWith("*") || line.trim().startsWith("-")) {
        const change = line.trim().replace(/^[*-]\s*/, "")
        if (change && !change.startsWith("**Full Changelog**")) {
          changes.push(change)
        }
      }
    }

    return changes.slice(0, 5) // Limit to 5 changes
  }

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-4xl font-bold">{t("updates.title")}</h1>
          {fallback && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <WifiOff className="h-3 w-3" />
              <span>{t("updates.cachedData")}</span>
            </div>
          )}
          {!fallback && !loading && (
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <Wifi className="h-3 w-3" />
              <span>{t("updates.liveFromGitHub")}</span>
            </div>
          )}
        </div>
        <p className="text-xl text-gray-600">
          {t("updates.subtitle")}
        </p>
      </div>

      {/* Latest Release Highlight */}
      {releases.length > 0 && (
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-green-800">Latest Release</CardTitle>
              </div>
              <Badge className="bg-green-100 text-green-800">{releases[0].tag_name}</Badge>
            </div>
            <CardDescription className="text-green-700">
              The newest version of Solidis is now available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-green-700">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Released {formatDate(releases[0].published_at)}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                by {releases[0].author.login}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-gray-500">
            <Clock className="h-4 w-4 animate-spin" />
            Loading releases...
          </div>
        </div>
      )}

      {/* Release History */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Release History</h2>
        <div className="space-y-6">
          {releases.map((release, index) => {
            const changes = parseChangelog(release.body)
            const isLatest = index === 0

            return (
              <Card key={release.tag_name}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-yellow-600" />
                          {release.tag_name}
                        </CardTitle>
                        {isLatest && <Badge className="bg-green-100 text-green-800">Latest</Badge>}
                      </div>
                      <CardTitle className="text-lg">{release.name}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(release.published_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {release.author.login}
                        </div>
                        <a
                          href={release.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-yellow-600 hover:text-yellow-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on GitHub
                        </a>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {changes.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">What's Changed:</h4>
                      <ul className="space-y-1">
                        {changes.map((change, changeIndex) => (
                          <li key={changeIndex} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-green-600 mt-1">•</span>
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {changes.length === 0 && release.body && (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown >{`${release.body.slice(0, 300)}...`}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Error State */}
      {error && fallback && (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm">Showing cached release data • GitHub API temporarily unavailable</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Features */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Upcoming Features</h2>
        <div className="space-y-4">
          {upcomingFeatures.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                  <Badge className={getStatusColor(feature.status)}>{feature.status}</Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Subscribe Section */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Stay Updated</CardTitle>
          <CardDescription>Get notified about new releases and important updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">GitHub Releases</h3>
              <p className="text-sm text-gray-600 mb-3">Watch the repository to get notified about new releases</p>
              <a
                href="https://github.com/vcms-io/solidis/releases"
                className="text-yellow-600 hover:underline text-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub →
              </a>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">npm Updates</h3>
              <p className="text-sm text-gray-600 mb-3">Follow the package on npm to track new versions</p>
              <a
                href="https://www.npmjs.com/package/@vcms-io/solidis"
                className="text-yellow-600 hover:underline text-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on npm →
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
