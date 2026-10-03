import { NextResponse } from 'next/server';

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  body: string;
  author: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://api.github.com/repos/vcms-io/solidis/releases',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Solidis-Documentation-Site',
        },
        signal: controller.signal,
        next: { revalidate: 3600 }, // Cache for 1 hour
      },
    );

    clearTimeout(timeoutId);

    if (response.status === 403) {
      console.warn('GitHub API rate limit exceeded for releases');
      return NextResponse.json({ releases: [], fallback: true });
    }

    if (!response.ok) {
      console.error(
        `GitHub Releases API responded with status: ${response.status}`,
      );
      return NextResponse.json({ releases: [], fallback: true });
    }

    const releases: GitHubRelease[] = await response.json();

    const filteredReleases = releases
      .filter((release) => !release.draft && !release.prerelease)
      .slice(0, 10)
      .map((release) => ({
        tag_name: release.tag_name,
        name: release.name || release.tag_name,
        published_at: release.published_at,
        prerelease: release.prerelease,
        draft: release.draft,
        body: release.body || '',
        author: {
          login: release.author?.login || 'unknown',
          avatar_url: release.author?.avatar_url || '',
        },
        html_url: release.html_url,
      }));

    return NextResponse.json({ releases: filteredReleases, fallback: false });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('GitHub Releases API request timed out');
    } else {
      console.error('Error fetching GitHub releases:', error);
    }

    return NextResponse.json({ releases: [], fallback: true });
  }
}
