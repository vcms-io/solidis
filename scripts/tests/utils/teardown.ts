/**
 * Root-level safety net that force-closes every client created during a test
 * file once all of its tests have settled.
 *
 * `node:test` runs `beforeEach`/`before` hooks for a test that later calls
 * `context.skip()` inside its body, but it does NOT run the matching
 * `afterEach`/`after` hooks for that skipped test. Any client opened in a
 * setup hook for a capability-gated test therefore leaks its TCP socket, which
 * keeps the event loop alive and hangs the runner indefinitely (the process
 * never exits because a handle is still open).
 *
 * Registering a single root `after` hook here — imported transitively by every
 * suite through `./index.ts` — guarantees that all tracked clients are closed
 * regardless of how individual tests skip or fail.
 */

import { after } from 'node:test';

import { closeAllClients } from './client.ts';

after(async () => {
  await closeAllClients();
});
