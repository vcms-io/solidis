/**
 * HELP subcommands: verify each returns a non-empty string array describing
 * available options for its parent command group.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/index.ts';

describe('help-subcommands', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
  });

  after(async () => {
    await closeClient(client);
  });

  it('returns help for ACL', async () => {
    const help = await client.aclHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for CLIENT', async () => {
    const help = await client.clientHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for COMMAND', async () => {
    const help = await client.commandHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for CONFIG', async () => {
    const help = await client.configHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for FUNCTION', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('FUNCTION HELP requires Redis 7.0+');
      return;
    }

    const help = await client.functionHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for LATENCY', async () => {
    const help = await client.latencyHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for MEMORY', async () => {
    const help = await client.memoryHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for MODULE', async () => {
    const help = await client.moduleHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for OBJECT', async () => {
    const help = await client.objectHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for PUBSUB', async () => {
    const help = await client.pubsubHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for SCRIPT', async () => {
    const help = await client.scriptHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for SLOWLOG', async () => {
    const help = await client.slowlogHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for XGROUP', async () => {
    const help = await client.xgroupHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });

  it('returns help for XINFO', async () => {
    const help = await client.xinfoHelp();

    assert.ok(help.length > 0);
    assert.ok(help.every((line) => typeof line === 'string'));
  });
});
