/** Root-level after hook: force-closes all tracked clients after each suite. */

import { after } from 'node:test';

import { closeAllClients } from './client.ts';

after(async () => {
  await closeAllClients();
});
