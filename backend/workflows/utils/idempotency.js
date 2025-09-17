import { redis } from '../../infra/redis.js';

const TTL_SECONDS = 60 * 60; // 1 hour

export async function acquire(key, runId) {
  const lockKey = `wf:idemp:${key}`;
  const existing = await redis.get(lockKey);
  if (existing && existing !== 'done') return false;
  await redis.set(lockKey, runId, { ex: TTL_SECONDS });
  return true;
}

export async function done(key) {
  const lockKey = `wf:idemp:${key}`;
  await redis.set(lockKey, 'done', { ex: 60 });
}

export async function fail(key) {
  const lockKey = `wf:idemp:${key}`;
  await redis.del(lockKey);
}


