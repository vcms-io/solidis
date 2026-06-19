import { buildWithoutArgumentsStringArrayExecutor } from './utils/index.ts';

export const aclUsers = buildWithoutArgumentsStringArrayExecutor(
  'ACL',
  'USERS',
);
