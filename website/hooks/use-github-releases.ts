'use client';

import { useEffect, useState } from 'react';

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

interface GitHubReleasesResponse {
  releases: GitHubRelease[];
  fallback: boolean;
}

export function useGitHubReleases() {
  const [data, setData] = useState<GitHubReleasesResponse>({
    releases: [],
    fallback: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const response = await fetch('/api/github/releases', {
          cache: 'force-cache',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const releaseData = await response.json();
        setData(releaseData);
        setError(null);
      } catch (error) {
        console.warn(
          'Failed to fetch GitHub releases, using fallback data:',
          error,
        );
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (typeof window !== 'undefined') {
      fetchReleases();
    }
  }, []);

  return { ...data, loading, error };
}
