import type { Redis as IORedis } from 'ioredis';

export type RedisConstructor = typeof IORedis;
export type RedisClient = InstanceType<RedisConstructor>;
