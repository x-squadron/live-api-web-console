import { Redis } from '@upstash/redis';

/**
 * Checks if a request is duplicate based on meeting ID and end time
 * @param meetingId - The meeting ID
 * @param endTime - The end time of the meeting
 * @returns Promise<{ isDuplicate: boolean; idempotencyKey: string }>
 */
export async function checkIdempotency(
  meetingId: string,
  endTime: string
): Promise<{ isDuplicate: boolean; idempotencyKey: string }> {
  const idempotencyKey = `meeting:${meetingId}_${endTime}`;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[idem] Redis env not set, skipping idempotency');
    return { isDuplicate: false, idempotencyKey };
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const exists = await redis.get(idempotencyKey);
    
    if (exists) {
      console.warn('[idem] duplicate request detected', { idempotencyKey });
      return { isDuplicate: true, idempotencyKey };
    }

    // Reserve the key with 24 hour TTL
    await redis.set(idempotencyKey, '1', { ex: 60 * 60 * 24 });
    console.log('[idem] idempotency key reserved', { idempotencyKey });
    
    return { isDuplicate: false, idempotencyKey };
  } catch (error) {
    console.error('[idem] Redis error during idempotency check', error);
    // On Redis error, allow the request to proceed (fail open)
    return { isDuplicate: false, idempotencyKey };
  }
}
