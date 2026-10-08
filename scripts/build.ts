import {
  buildCommonJsDeclarations,
  buildDistributions,
} from './build/distributions.ts';

await buildDistributions('distributions');
await buildCommonJsDeclarations('distributions');
