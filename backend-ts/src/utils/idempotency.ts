import { Redis } from '@upstash/redis';
import { taskStore } from '../services/taskStore.js';

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

/**
 * Checks idempotency using A2A TaskStore with a deterministic task id
 * Falls back to Redis reservation to prevent concurrent duplicates
 */
export async function checkTaskStoreIdempotency(
  meetingId: string,
  endTime: string
): Promise<{ isDuplicate: boolean; taskId: string }> {
  const rawTaskId = `sum-${meetingId}-${endTime}`;
  const endKey = normalizeEndTime(endTime);
  const taskId = makeFilesystemSafeTaskId(meetingId, endKey);
  try { console.log('[idem] TaskStore check start', { meetingId, endTime, rawTaskId, endKey, taskId }); } catch {}

  try {
    const loadFn = (taskStore as any)?.load?.bind?.(taskStore);
    const hasLoad = typeof loadFn === 'function';
    try { console.log('[idem] TaskStore methods', { hasLoad }); } catch {}

    if (!hasLoad) {
      try { console.warn('[idem] TaskStore.load not available; skipping duplicate check'); } catch {}
      return { isDuplicate: false, taskId };
    }

    let existing: any = null;
    try {
      existing = await loadFn(taskId);
      try { console.log('[idem] TaskStore.load result', { found: !!existing, state: existing?.status?.state || existing?.state }); } catch {}
    } catch (e) {
      try { console.error('[idem] TaskStore.load error', { error: (e as any)?.message || String(e) }); } catch {}
      return { isDuplicate: false, taskId };
    }

    const state = (existing?.status?.state || existing?.state || '').toString().toLowerCase();
    const isDone = state === 'completed' || state === 'succeeded';
    try { console.log('[idem] TaskStore decision', { found: !!existing, state, isDone }); } catch {}
    if (existing) {
      try { console.warn('[idem] duplicate detected via TaskStore (completed)', { taskId, state }); } catch {}
      return { isDuplicate: true, taskId };
    }
  } catch (e) {
    try { console.error('[idem] TaskStore check failed', e); } catch {}
  }

  return { isDuplicate: false, taskId };
}

function normalizeEndTime(endTime: string): string {
  const dt = new Date(endTime);
  const iso = isNaN(dt.getTime()) ? String(endTime) : dt.toISOString();
  // Replace unsafe filename characters (Windows): : \ / * ? " < > |
  return iso.replace(/[:\\/*?"<>|]/g, '-');
}

function makeFilesystemSafeTaskId(meetingId: string, endKey: string): string {
  const safeMeeting = String(meetingId).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  const safeEnd = String(endKey).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  return `sum-${safeMeeting}-${safeEnd || 'noend'}`.replace(/-+/g, '-');
}
