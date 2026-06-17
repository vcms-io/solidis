import { payloadSeedBase } from './constants.ts';

import type { PayloadPool } from './types.ts';

export function makePayloadSeed(payloadBytes: number, caseIndex: number) {
  return (payloadSeedBase ^ (payloadBytes << 8) ^ (caseIndex << 16)) >>> 0;
}

function nextRandomState(state: number) {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

function makePayload(size: number, seed: number): Buffer {
  const payload = Buffer.allocUnsafe(size);
  let state = seed;

  for (let offset = 0; offset < size; offset += 1) {
    state = nextRandomState(state);
    payload[offset] = state >>> 24;
  }

  if (size > 0) {
    payload.writeUInt32LE(state, 0);
  }

  return payload;
}

export function makePayloadPool(
  size: number,
  units: number,
  slotsPerUnit: number,
  seed: number,
): PayloadPool {
  const safeSlotsPerUnit = Math.max(1, slotsPerUnit);
  const payloads = Array.from(
    { length: units * safeSlotsPerUnit },
    (_, index) => makePayload(size, (seed + index) >>> 0),
  );

  return {
    slotsPerUnit: safeSlotsPerUnit,
    payloads,
    at: (unitIndex: number, slot = 0) => {
      const normalizedSlot = slot % safeSlotsPerUnit;
      const index = unitIndex * safeSlotsPerUnit + normalizedSlot;
      const payload = payloads[index];

      if (!payload) {
        throw new Error(
          `Payload pool underrun: unit=${unitIndex}, slot=${slot}, slotsPerUnit=${safeSlotsPerUnit}`,
        );
      }

      return payload;
    },
  };
}
