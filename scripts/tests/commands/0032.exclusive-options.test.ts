/** Option types reject the combinations that the command grammar or the server rejects. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  CommandBloomFilterInsertOptions,
  CommandClientTrackingOptions,
  CommandClientUnblockOptions,
  CommandCuckooFilterInsertOptions,
  CommandDelExOptions,
  CommandExclusiveOptions,
  CommandFailoverOptions,
  CommandFunctionRestoreOptions,
  CommandGeoAddOptions,
  CommandGeoRadiusOptions,
  CommandGeoSearchByOptions,
  CommandGeoSearchFromOptions,
  CommandGeoSearchOptions,
  CommandGeoSearchStoreOptions,
  CommandGetExOptions,
  CommandJsonSetOptions,
  CommandLCSOptions,
  CommandMigrateOptions,
  CommandRestoreOptions,
  CommandScriptFlushOptions,
  CommandSetOptions,
  CommandShutdownOptions,
  CommandTimeSeriesRangeOptions,
  CommandZRangeOptions,
  CommandZRangeStoreOptions,
  RespCommandListFilter,
} from '../../../sources/index.ts';

type Accepts<Target, Value> = [Value] extends [Target] ? true : false;

type Empty = Record<never, never>;
type Target = { host: 'a'; port: 1 };
type Limit = { offset: 0; count: 1 };
type Radius = { radius: 1; unit: 'KM' };
type Box = { width: 1; height: 1; unit: 'KM' };
type Position = { longitude: 0; latitude: 0 };
type Aggregation = { type: 'avg'; bucketDuration: 1000 };
type Credentials = { username: 'a'; password: 'b' };

function assertChecks(accepted: true[], rejected: false[]) {
  assert.ok(accepted.every(Boolean));
  assert.ok(!rejected.some(Boolean));
}

describe('exclusive-options', () => {
  it('builds at-most-one and exactly-one groups from alternatives', () => {
    type Mode = CommandExclusiveOptions<{ left?: number } | { right?: string }>;
    type Origin = CommandExclusiveOptions<{ one: number } | { two: number }>;
    type Flags = CommandExclusiveOptions<{ on?: boolean } | { off?: boolean }>;

    const accepted: [
      Accepts<Mode, Empty>,
      Accepts<Mode, { left: 1 }>,
      Accepts<Mode, { right: 'a' }>,
      Accepts<Mode, { left: 1; right: undefined }>,
      Accepts<Origin, { one: 1 }>,
      Accepts<Flags, { on: true; off: false }>,
      Accepts<Flags, { on: boolean }>,
    ] = [true, true, true, true, true, true, true];
    const rejected: [
      Accepts<Mode, { left: 1; right: 'a' }>,
      Accepts<Mode, { left: 1; right: false }>,
      Accepts<Origin, Empty>,
      Accepts<Origin, { one: 1; two: 2 }>,
      Accepts<Flags, { on: true; off: true }>,
      Accepts<Flags, { on: boolean; off: boolean }>,
    ] = [false, false, false, false, false, false];

    assertChecks(accepted, rejected);
  });

  it('allows one expiration and one condition on SET, GETEX and DELEX', () => {
    const accepted: [
      Accepts<
        CommandSetOptions,
        {
          expireInSeconds: 1;
          setIfKeyNotExists: true;
          returnOldValue: true;
          returnOldValueAsBuffer: true;
        }
      >,
      Accepts<
        CommandSetOptions,
        { keepOriginalTimeToLive: true; setIfValueEquals: Buffer }
      >,
      Accepts<
        CommandSetOptions,
        { keepOriginalTimeToLive: false; expireAtMilliseconds: 1 }
      >,
      Accepts<CommandSetOptions, { setIfKeyExists: boolean }>,
      Accepts<CommandGetExOptions, { persist: true }>,
      Accepts<CommandGetExOptions, { expireAtSeconds: 1 }>,
      Accepts<CommandDelExOptions, { ifDigestNotEquals: 'a' }>,
    ] = [true, true, true, true, true, true, true];
    const rejected: [
      Accepts<
        CommandSetOptions,
        { expireInSeconds: 1; expireInMilliseconds: 1 }
      >,
      Accepts<
        CommandSetOptions,
        { expireAtSeconds: 1; keepOriginalTimeToLive: true }
      >,
      Accepts<
        CommandSetOptions,
        { setIfKeyNotExists: true; setIfKeyExists: true }
      >,
      Accepts<
        CommandSetOptions,
        { setIfKeyExists: true; setIfValueEquals: 'a' }
      >,
      Accepts<
        CommandSetOptions,
        { setIfDigestEquals: 'a'; setIfDigestNotEquals: 'b' }
      >,
      Accepts<CommandGetExOptions, { persist: true; expireInSeconds: 1 }>,
      Accepts<
        CommandGetExOptions,
        { expireAtSeconds: 1; expireAtMilliseconds: 1 }
      >,
      Accepts<
        CommandDelExOptions,
        { ifValueEquals: 'a'; ifValueNotEquals: 'b' }
      >,
      Accepts<CommandDelExOptions, { ifValueEquals: 'a'; ifDigestEquals: 'b' }>,
      Accepts<CommandGetExOptions, { expireInSeconds: 1; expireAtSeconds: 1 }>,
    ] = [false, false, false, false, false, false, false, false, false, false];

    assertChecks(accepted, rejected);
  });

  it('keeps tracking, shutdown, failover and restore modes apart', () => {
    const accepted: [
      Accepts<
        CommandClientTrackingOptions,
        { bcast: true; prefixes: string[]; noloop: true; redirect: 1 }
      >,
      Accepts<CommandClientTrackingOptions, { optout: true; optin: false }>,
      Accepts<CommandClientTrackingOptions, { bcast: boolean }>,
      Accepts<CommandClientUnblockOptions, { error: true }>,
      Accepts<RespCommandListFilter, { aclcat: 'string' }>,
      Accepts<CommandShutdownOptions, { nosave: true; now: true; force: true }>,
      Accepts<CommandShutdownOptions, { save: true; nosave: false }>,
      Accepts<CommandShutdownOptions, { abort: true }>,
      Accepts<CommandFailoverOptions, { to: Target; timeout: 1 }>,
      Accepts<CommandFailoverOptions, { to: Target; timeout: 1; force: true }>,
      Accepts<CommandFailoverOptions, { abort: true }>,
      Accepts<CommandScriptFlushOptions, { async: true }>,
      Accepts<CommandFunctionRestoreOptions, { append: true }>,
      Accepts<
        CommandMigrateOptions,
        { auth2: Credentials; copy: true; replace: true; keys: string[] }
      >,
      Accepts<
        CommandRestoreOptions,
        { replace: true; absttl: true; idletime: 1 }
      >,
    ] = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];
    const rejected: [
      Accepts<CommandClientTrackingOptions, { prefixes: string[] }>,
      Accepts<CommandClientTrackingOptions, { bcast: true; optin: true }>,
      Accepts<CommandClientTrackingOptions, { optin: true; optout: true }>,
      Accepts<CommandClientUnblockOptions, { timeout: true; error: true }>,
      Accepts<RespCommandListFilter, { module: 'json'; pattern: 'json*' }>,
      Accepts<CommandShutdownOptions, { nosave: true; save: true }>,
      Accepts<CommandShutdownOptions, { abort: true; now: true }>,
      Accepts<CommandFailoverOptions, { force: true }>,
      Accepts<CommandFailoverOptions, { to: Target; force: true }>,
      Accepts<CommandFailoverOptions, { timeout: 1; force: true }>,
      Accepts<CommandFailoverOptions, { abort: true; timeout: 1 }>,
      Accepts<CommandScriptFlushOptions, { sync: true; async: true }>,
      Accepts<CommandFunctionRestoreOptions, { flush: true; replace: true }>,
      Accepts<CommandMigrateOptions, { auth: 'a'; auth2: Credentials }>,
      Accepts<CommandRestoreOptions, { idletime: 1; freq: 1 }>,
      Accepts<CommandShutdownOptions, { abort: true; nosave: true }>,
      Accepts<CommandShutdownOptions, { abort: true; save: true }>,
      Accepts<CommandShutdownOptions, { abort: true; force: true }>,
      Accepts<CommandFailoverOptions, { abort: true; to: Target }>,
      Accepts<CommandFunctionRestoreOptions, { replace: true; append: true }>,
    ] = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];

    assertChecks(accepted, rejected);
  });

  it('requires one origin and one shape for geo searches', () => {
    const accepted: [
      Accepts<CommandGeoSearchFromOptions, { frommember: 'a' }>,
      Accepts<CommandGeoSearchFromOptions, { fromlonlat: Position }>,
      Accepts<CommandGeoSearchByOptions, { byradius: Radius }>,
      Accepts<CommandGeoSearchByOptions, { bybox: Box }>,
      Accepts<
        CommandGeoSearchOptions,
        { asc: true; count: 1; any: true; withDist: true; withCoord: true }
      >,
      Accepts<CommandGeoSearchOptions, { count: number | undefined }>,
      Accepts<CommandGeoRadiusOptions, { store: 'a'; count: 1; desc: true }>,
      Accepts<CommandGeoRadiusOptions, { storedist: 'a' }>,
      Accepts<CommandGeoRadiusOptions, { withHash: true; withDist: true }>,
      Accepts<
        CommandGeoSearchStoreOptions,
        { storedist: true; desc: true; count: 2 }
      >,
      Accepts<CommandGeoAddOptions, { xx: true; ch: true }>,
    ] = [true, true, true, true, true, true, true, true, true, true, true];
    const rejected: [
      Accepts<CommandGeoSearchFromOptions, Empty>,
      Accepts<
        CommandGeoSearchFromOptions,
        { frommember: 'a'; fromlonlat: Position }
      >,
      Accepts<CommandGeoSearchByOptions, Empty>,
      Accepts<CommandGeoSearchByOptions, { byradius: Radius; bybox: Box }>,
      Accepts<CommandGeoSearchOptions, { asc: true; desc: true }>,
      Accepts<CommandGeoSearchOptions, { any: true }>,
      Accepts<CommandGeoSearchOptions, { unit: 'KM' }>,
      Accepts<CommandGeoRadiusOptions, { store: 'a'; storedist: 'b' }>,
      Accepts<CommandGeoRadiusOptions, { store: 'a'; withDist: true }>,
      Accepts<CommandGeoRadiusOptions, { storedist: 'a'; withCoord: true }>,
      Accepts<CommandGeoSearchStoreOptions, { withDist: true }>,
      Accepts<CommandGeoAddOptions, { nx: true; xx: true }>,
    ] = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];

    assertChecks(accepted, rejected);
  });

  it('only accepts the ranges, limits and scores that ZRANGE accepts', () => {
    const accepted: [
      Accepts<
        CommandZRangeOptions,
        { byScore: true; limit: Limit; withScores: true; reverse: true }
      >,
      Accepts<CommandZRangeOptions, { byLex: true; limit: Limit }>,
      Accepts<CommandZRangeOptions, { withScores: true; reverse: true }>,
      Accepts<CommandZRangeOptions, { byScore: boolean; withScores: true }>,
      Accepts<
        CommandZRangeStoreOptions,
        { byLex: true; limit: Limit; reverse: true }
      >,
      Accepts<CommandZRangeStoreOptions, Empty>,
    ] = [true, true, true, true, true, true];
    const rejected: [
      Accepts<CommandZRangeOptions, { byScore: true; byLex: true }>,
      Accepts<CommandZRangeOptions, { limit: Limit }>,
      Accepts<CommandZRangeOptions, { byLex: true; withScores: true }>,
      Accepts<CommandZRangeStoreOptions, { limit: Limit }>,
      Accepts<CommandZRangeStoreOptions, { byScore: true; byLex: true }>,
    ] = [false, false, false, false, false];

    assertChecks(accepted, rejected);
  });

  it('rejects contradictory module and string options', () => {
    const accepted: [
      Accepts<CommandJsonSetOptions, { xx: true }>,
      Accepts<
        CommandBloomFilterInsertOptions,
        { capacity: 1; error: 0.1; expansion: 2; nonScaling: true }
      >,
      Accepts<
        CommandBloomFilterInsertOptions,
        { nocreate: true; expansion: 2 }
      >,
      Accepts<CommandCuckooFilterInsertOptions, { capacity: 1 }>,
      Accepts<
        CommandLCSOptions,
        { idx: true; minmatchlen: 2; withmatchlen: true }
      >,
      Accepts<
        CommandTimeSeriesRangeOptions,
        { aggregation: Aggregation; align: 0; count: 1 }
      >,
      Accepts<
        CommandTimeSeriesRangeOptions,
        { aggregation: Aggregation | undefined }
      >,
    ] = [true, true, true, true, true, true, true];
    const rejected: [
      Accepts<CommandJsonSetOptions, { nx: true; xx: true }>,
      Accepts<CommandBloomFilterInsertOptions, { nocreate: true; capacity: 1 }>,
      Accepts<CommandBloomFilterInsertOptions, { nocreate: true; error: 0.1 }>,
      Accepts<
        CommandCuckooFilterInsertOptions,
        { nocreate: true; capacity: 1 }
      >,
      Accepts<CommandLCSOptions, { len: true; idx: true }>,
      Accepts<CommandTimeSeriesRangeOptions, { align: 0 }>,
    ] = [false, false, false, false, false, false];

    assertChecks(accepted, rejected);
  });
});
