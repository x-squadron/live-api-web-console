// Upstash Redis-based idempotency - keys persist in Redis
import { Redis } from '@upstash/redis';

// Initialize Redis client with fallback
let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[Idempotency] Redis client initialized successfully');
  } else {
    console.warn('[Idempotency] Redis credentials not found, using in-memory fallback');
  }
} catch (error) {
  console.error('[Idempotency] Failed to initialize Redis client:', error.message);
}

// Fallback in-memory storage
const idempotencyMap = new Map();

// Key format: workflow:idempotency:{meetingId}:{endTime}
const IDEMPOTENCY_PREFIX = 'workflow:idempotency';

export async function acquire(key, runId) {
  try {
    const redisKey = `${IDEMPOTENCY_PREFIX}:${key}`;
    
    if (redis) {
      // Use Redis
      const existing = await redis.get(redisKey);
      if (existing) {
        console.log(`[Idempotency] Key ${redisKey} already exists in Redis, workflow already running`);
        return false; // Already running
      }
      
      // Set the key in Redis (persistent - no TTL)
      await redis.set(redisKey, {
        runId,
        status: 'running',
        timestamp: new Date().toISOString(),
        acquiredAt: Date.now()
      });
      
      console.log(`[Idempotency] Acquired lock in Redis for ${redisKey}`);
      return true;
    } else {
      // Fallback to in-memory
      const existing = idempotencyMap.get(key);
      if (existing && existing.status !== 'done') {
        console.log(`[Idempotency] Key ${key} already exists in memory, workflow already running`);
        return false; // Already running
      }
      
      // Set the key in memory
      idempotencyMap.set(key, {
        runId,
        status: 'running',
        timestamp: new Date().toISOString(),
        acquiredAt: Date.now()
      });
      
      console.log(`[Idempotency] Acquired lock in memory for ${key}`);
      return true;
    }
  } catch (error) {
    console.error('[Idempotency] Error acquiring lock:', error);
    // If Redis fails, allow the workflow to proceed
    return true;
  }
}

export async function done(key, runId) {
  try {
    if (redis) {
      // Use Redis
      const redisKey = `${IDEMPOTENCY_PREFIX}:${key}`;
      
      // Update status to done but keep the key in Redis
      await redis.set(redisKey, {
        runId,
        status: 'done',
        timestamp: new Date().toISOString(),
        completedAt: Date.now()
      });
      
      console.log(`[Idempotency] Marked ${redisKey} as done in Redis`);
    } else {
      // Fallback to in-memory
      const existing = idempotencyMap.get(key);
      if (existing) {
        existing.status = 'done';
        existing.timestamp = new Date().toISOString();
        existing.completedAt = Date.now();
      }
      
      console.log(`[Idempotency] Marked ${key} as done in memory`);
    }
  } catch (error) {
    console.error('[Idempotency] Error marking as done:', error);
  }
}

export async function fail(key, runId) {
  try {
    if (redis) {
      // Use Redis
      const redisKey = `${IDEMPOTENCY_PREFIX}:${key}`;
      
      // Update status to failed but keep the key in Redis
      await redis.set(redisKey, {
        runId,
        status: 'failed',
        timestamp: new Date().toISOString(),
        failedAt: Date.now()
      });
      
      console.log(`[Idempotency] Marked ${redisKey} as failed in Redis`);
    } else {
      // Fallback to in-memory
      const existing = idempotencyMap.get(key);
      if (existing) {
        existing.status = 'failed';
        existing.timestamp = new Date().toISOString();
        existing.failedAt = Date.now();
      }
      
      console.log(`[Idempotency] Marked ${key} as failed in memory`);
    }
  } catch (error) {
    console.error('[Idempotency] Error marking as failed:', error);
  }
}

// Helper function to generate idempotency key from meeting data
export function generateIdempotencyKey(meetingId, endTime) {
  const meetingDate = new Date(endTime);
  const year = meetingDate.getUTCFullYear();
  const month = String(meetingDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(meetingDate.getUTCDate()).padStart(2, '0');
  const dateLabel = `${year}-${month}-${day}`;
  
  return `${dateLabel}_${meetingId}`;
}


