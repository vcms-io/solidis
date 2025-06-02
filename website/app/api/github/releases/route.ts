import { NextResponse } from "next/server"

// Fallback data to use when GitHub API is unavailable
const FALLBACK_RELEASES = [
  {
    tag_name: "v0.0.5",
    name: "v0.0.5",
    published_at: "2024-01-15T00:00:00Z",
    prerelease: false,
    draft: false,
    body: "## What's Changed\n\n* Improved connection pool efficiency by 25%\n* Fixed memory leak in long-running connections\n* Added support for Redis 7.0 features\n* Enhanced error messages for better debugging\n* Updated TypeScript definitions\n\n**Full Changelog**: https://github.com/vcms-io/solidis/compare/v0.0.4...v0.0.5",
    author: {
      login: "github-actions",
      avatar_url: "https://avatars.githubusercontent.com/u/41898282?v=4",
    },
    html_url: "https://github.com/vcms-io/solidis/releases/tag/v0.0.5",
  },
  {
    tag_name: "v0.0.4",
    name: "v0.0.4",
    published_at: "2024-01-08T00:00:00Z",
    prerelease: false,
    draft: false,
    body: "## What's Changed\n\n* Setup Connection with Provided Options & Expose URI by @jay-l-e-e in #8\n* Added support for Redis Streams\n* Implemented automatic retry mechanism\n* New configuration options for fine-tuning\n\n**Full Changelog**: https://github.com/vcms-io/solidis/compare/v0.0.3...v0.0.4",
    author: {
      login: "jay-l-e-e",
      avatar_url: "https://avatars.githubusercontent.com/u/12345678?v=4",
    },
    html_url: "https://github.com/vcms-io/solidis/releases/tag/v0.0.4",
  },
]

export async function GET() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch("https://api.github.com/repos/vcms-io/solidis/releases", {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Solidis-Documentation-Site",
      },
      signal: controller.signal,
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    clearTimeout(timeoutId)

    if (response.status === 403) {
      console.warn("GitHub API rate limit exceeded for releases")
      return NextResponse.json({ releases: FALLBACK_RELEASES, fallback: true })
    }

    if (!response.ok) {
      console.error(`GitHub Releases API responded with status: ${response.status}`)
      return NextResponse.json({ releases: FALLBACK_RELEASES, fallback: true })
    }

    const releases = await response.json()

    // Filter out drafts and prereleases, and limit to latest 10
    const filteredReleases = releases
      .filter((release: any) => !release.draft && !release.prerelease)
      .slice(0, 10)
      .map((release: any) => ({
        tag_name: release.tag_name,
        name: release.name || release.tag_name,
        published_at: release.published_at,
        prerelease: release.prerelease,
        draft: release.draft,
        body: release.body || "",
        author: {
          login: release.author?.login || "unknown",
          avatar_url: release.author?.avatar_url || "",
        },
        html_url: release.html_url,
      }))

    return NextResponse.json({
      releases: filteredReleases.length > 0 ? filteredReleases : FALLBACK_RELEASES,
      fallback: filteredReleases.length === 0,
    })
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("GitHub Releases API request timed out")
    } else {
      console.error("Error fetching GitHub releases:", error)
    }

    return NextResponse.json({ releases: FALLBACK_RELEASES, fallback: true })
  }
}
