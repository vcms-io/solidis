import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandTimeSeriesCreateRuleOptions } from '../index.ts';

export function createCommand(
  sourceKey: string,
  destinationKey: string,
  options: CommandTimeSeriesCreateRuleOptions,
) {
  const command = [
    'TS.CREATERULE',
    sourceKey,
    destinationKey,
    'AGGREGATION',
    options.aggregation.type,
    `${options.aggregation.bucketDuration}`,
  ];

  if (options.aggregation.alignTimestamp !== undefined) {
    command.push(`${options.aggregation.alignTimestamp}`);
  }

  return command;
}

export async function tsCreaterule<T>(
  this: T,
  sourceKey: string,
  destinationKey: string,
  options: CommandTimeSeriesCreateRuleOptions,
) {
  return await executeCommand(
    this,
    createCommand(sourceKey, destinationKey, options),
    tryReplyOK,
  );
}
