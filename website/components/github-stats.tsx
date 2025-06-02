"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useGitHubStats } from "@/hooks/use-github-stats"
import { Star, GitFork, Eye, AlertCircle, Wifi, Clock } from "lucide-react"

export function GitHubStats() {
  const { stats, loading, error } = useGitHubStats()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img src="https://resources.vcms.io/assets/solidis.png" alt="Solidis" className="h-6 w-6" />
          GitHub Statistics
          {stats.fallback && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3 w-3" />
              <span>Cached data</span>
            </div>
          )}
          {!stats.fallback && !loading && (
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <Wifi className="h-3 w-3" />
              <span>Live data</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Stars</span>
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : stats.stars.toLocaleString()}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <GitFork className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Forks</span>
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : stats.forks.toLocaleString()}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Eye className="h-4 w-4 text-yellow-700" />
              <span className="text-sm font-medium">Watchers</span>
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : stats.watchers.toLocaleString()}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Issues</span>
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : stats.openIssues.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-gray-500 text-center">
            {stats.fallback ? (
              <span className="text-amber-600">Repository data from GitHub • Updated regularly</span>
            ) : (
              <span>Last updated: {new Date(stats.lastUpdated).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {error && stats.fallback && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Showing repository statistics • GitHub API temporarily unavailable</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
