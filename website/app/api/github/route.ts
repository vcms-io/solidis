import { NextResponse } from "next/server";

// Fallback data to use when GitHub API is unavailable
const FALLBACK_DATA = {
  stars: 108,
  forks: 1,
  watchers: 5,
  openIssues: 3,
  lastUpdated: new Date().toISOString(),
  fallback: true,
};

export async function GET() {
  try {
    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      "https://api.github.com/repos/vcms-io/solidis",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Solidis-Documentation-Site",
        },
        signal: controller.signal,
        next: { revalidate: 7200 }, // Cache for 2 hours to reduce API calls
      }
    );

    clearTimeout(timeoutId);

    // Handle different HTTP status codes
    if (response.status === 403) {
      console.warn("GitHub API rate limit exceeded or access forbidden");
      return NextResponse.json(FALLBACK_DATA);
    }

    if (response.status === 404) {
      console.warn("GitHub repository not found");
      return NextResponse.json(FALLBACK_DATA);
    }

    if (!response.ok) {
      console.error(`GitHub API responded with status: ${response.status}`);
      return NextResponse.json(FALLBACK_DATA);
    }

    const data = await response.json();

    return NextResponse.json({
      stars: data.stargazers_count || FALLBACK_DATA.stars,
      forks: data.forks_count || FALLBACK_DATA.forks,
      watchers: data.watchers_count || FALLBACK_DATA.watchers,
      openIssues: data.open_issues_count || FALLBACK_DATA.openIssues,
      lastUpdated: data.updated_at || FALLBACK_DATA.lastUpdated,
      fallback: false,
    });
  } catch (error) {
    // Handle network errors, timeouts, etc.
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("GitHub API request timed out");
    } else {
      console.error("Error fetching GitHub data:", error);
    }

    return NextResponse.json(FALLBACK_DATA);
  }
}
