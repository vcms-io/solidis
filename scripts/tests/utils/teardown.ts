/**
 * Root-level after hook: quits every tracked client and closes every mock
 * server once a file's tests are done, so a failed test cannot keep the file
 * running.
 */

import { after } from 'node:test';

import { closeAllClients } from './client.ts';
import { closeAllServers } from './mocks.ts';

after(async () => {
  closeAllClients();

  await closeAllServers();
});
