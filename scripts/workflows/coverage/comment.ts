import { readFileSync } from 'node:fs';

const MARKER = '<!-- solidis-coverage -->';

const [reportPath, repository, pullRequestNumber, token] =
  process.argv.slice(2);

if (!reportPath || !repository || !pullRequestNumber || !token) {
  console.error(
    'Usage: comment.ts <report-path> <owner/repo> <pull-request-number> <github-token>',
  );
  process.exit(1);
}

const reportContent = readFileSync(reportPath, 'utf8');
const commentBody = `${MARKER}\n${reportContent}`;

const [owner, repositoryName] = repository.split('/');
const issueNumber = Number(pullRequestNumber);

const requestHeaders = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const apiBase = `https://api.github.com/repos/${owner}/${repositoryName}`;

const commentsResponse = await fetch(
  `${apiBase}/issues/${issueNumber}/comments?per_page=100`,
  { headers: requestHeaders },
);

if (!commentsResponse.ok) {
  console.error(`Failed to list comments: ${commentsResponse.status}`);
  process.exit(1);
}

const comments = (await commentsResponse.json()) as {
  id: number;
  body?: string;
}[];

const existingComment = comments.find((comment) =>
  comment.body?.includes(MARKER),
);

if (existingComment) {
  const response = await fetch(
    `${apiBase}/issues/comments/${existingComment.id}`,
    {
      method: 'PATCH',
      headers: { ...requestHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    },
  );

  if (!response.ok) {
    console.error(`Failed to update comment: ${response.status}`);
    process.exit(1);
  }

  console.log(`Updated comment #${existingComment.id}`);
} else {
  const response = await fetch(`${apiBase}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { ...requestHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: commentBody }),
  });

  if (!response.ok) {
    console.error(`Failed to create comment: ${response.status}`);
    process.exit(1);
  }

  console.log('Created coverage comment');
}
