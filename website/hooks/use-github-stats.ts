"use client"

import { useState, useEffect } from "react"

interface GitHubStats {
  stars: number
  forks: number
  watchers: number
  openIssues: number
  lastUpdated: string
  fallback?: boolean
}

const INITIAL_STATS: GitHubStats = {
  stars: 108,
  forks: 1,
  watchers: 5,
  openIssues: 3,
  lastUpdated: new Date().toISOString(),
  fallback: true,
}

export function useGitHubStats() {
  const [stats, setStats] = useState<GitHubStats>(INITIAL_STATS)
  const [loading, setLoading] = useState(false) // Start with false since we have initial data
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)

        const response = await fetch("/api/github", {
          cache: "force-cache",
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setStats(data)
        setError(null)
      } catch (err) {
        console.warn("Failed to fetch GitHub stats, using fallback data:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        // Keep the initial fallback data
        setStats(INITIAL_STATS)
      } finally {
        setLoading(false)
      }
    }

    // Only try to fetch if we're in a browser environment
    if (typeof window !== "undefined") {
      fetchStats()
    }
  }, [])

  return { stats, loading, error }
}
