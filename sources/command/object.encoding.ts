import { buildKeyStringOrNullExecutor } from './utils/index.ts';

export const objectEncoding = buildKeyStringOrNullExecutor(
  'OBJECT',
  'ENCODING',
);
