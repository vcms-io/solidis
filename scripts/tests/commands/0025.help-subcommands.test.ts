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

    assert.match(help[0], /^ACL <subcommand> /);

    assert.ok(help.length >= 2, 'ACL HELP must return multiple lines');
    assert.ok(
      help.every((line) => typeof line === 'string'),
      'every ACL HELP line must be a string',
    );
    assert.ok(
      help.some((line) => line.toUpperCase().includes('CAT')),
      'ACL HELP must mention the CAT subcommand',
    );
  });

  it('returns help for CLIENT', async () => {
    const help = await client.clientHelp();

    assert.match(help[0], /^CLIENT <subcommand> /);

    assert.ok(help.length >= 2, 'CLIENT HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('SETNAME')),
      'CLIENT HELP must mention the SETNAME subcommand',
    );
  });

  it('returns help for COMMAND', async () => {
    const help = await client.commandHelp();

    assert.match(help[0], /^COMMAND <subcommand> /);

    assert.ok(help.length >= 2, 'COMMAND HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('COUNT')),
      'COMMAND HELP must mention the COUNT subcommand',
    );
  });

  it('returns help for CONFIG', async () => {
    const help = await client.configHelp();

    assert.match(help[0], /^CONFIG <subcommand> /);

    assert.ok(help.length >= 2, 'CONFIG HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('GET')),
      'CONFIG HELP must mention the GET subcommand',
    );
  });

  it('returns help for FUNCTION', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('FUNCTION HELP requires Redis 7.0+');
      return;
    }

    const help = await client.functionHelp();

    assert.match(help[0], /^FUNCTION <subcommand> /);

    assert.ok(help.length >= 2, 'FUNCTION HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('LOAD')),
      'FUNCTION HELP must mention the LOAD subcommand',
    );
  });

  it('returns help for LATENCY', async () => {
    const help = await client.latencyHelp();

    assert.match(help[0], /^LATENCY <subcommand> /);

    assert.ok(help.length >= 2, 'LATENCY HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('LATEST')),
      'LATENCY HELP must mention the LATEST subcommand',
    );
  });

  it('returns help for MEMORY', async () => {
    const help = await client.memoryHelp();

    assert.match(help[0], /^MEMORY <subcommand> /);

    assert.ok(help.length >= 2, 'MEMORY HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('USAGE')),
      'MEMORY HELP must mention the USAGE subcommand',
    );
  });

  it('returns help for MODULE', async () => {
    const help = await client.moduleHelp();

    assert.match(help[0], /^MODULE <subcommand> /);

    assert.ok(help.length >= 2, 'MODULE HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('LIST')),
      'MODULE HELP must mention the LIST subcommand',
    );
  });

  it('returns help for OBJECT', async () => {
    const help = await client.objectHelp();

    assert.match(help[0], /^OBJECT <subcommand> /);

    assert.ok(help.length >= 2, 'OBJECT HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('ENCODING')),
      'OBJECT HELP must mention the ENCODING subcommand',
    );
  });

  it('returns help for PUBSUB', async () => {
    const help = await client.pubsubHelp();

    assert.match(help[0], /^PUBSUB <subcommand> /);

    assert.ok(help.length >= 2, 'PUBSUB HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('CHANNELS')),
      'PUBSUB HELP must mention the CHANNELS subcommand',
    );
  });

  it('returns help for SCRIPT', async () => {
    const help = await client.scriptHelp();

    assert.match(help[0], /^SCRIPT <subcommand> /);

    assert.ok(help.length >= 2, 'SCRIPT HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('LOAD')),
      'SCRIPT HELP must mention the LOAD subcommand',
    );
  });

  it('returns help for SLOWLOG', async () => {
    const help = await client.slowlogHelp();

    assert.match(help[0], /^SLOWLOG <subcommand> /);

    assert.ok(help.length >= 2, 'SLOWLOG HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('GET')),
      'SLOWLOG HELP must mention the GET subcommand',
    );
  });

  it('returns help for XGROUP', async () => {
    const help = await client.xgroupHelp();

    assert.match(help[0], /^XGROUP <subcommand> /);

    assert.ok(help.length >= 2, 'XGROUP HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('CREATE')),
      'XGROUP HELP must mention the CREATE subcommand',
    );
  });

  it('returns help for XINFO', async () => {
    const help = await client.xinfoHelp();

    assert.match(help[0], /^XINFO <subcommand> /);

    assert.ok(help.length >= 2, 'XINFO HELP must return multiple lines');
    assert.ok(
      help.some((line) => line.toUpperCase().includes('STREAM')),
      'XINFO HELP must mention the STREAM subcommand',
    );
  });
});
