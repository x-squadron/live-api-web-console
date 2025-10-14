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
): Promise<{ isDuplicate: boolean; taskId: string; canContinue?: boolean }> {
  const rawTaskId = `sum-${meetingId}-${endTime}`;
  const endKey = normalizeEndTime(endTime);
  const taskId = makeFilesystemSafeTaskId(meetingId, endKey);
  
  try {
    const loadFn = (taskStore as any)?.load?.bind?.(taskStore);
    if (typeof loadFn !== 'function') {
      return { isDuplicate: false, taskId };
    }

    // Check both summarizer and slack task states
    const summarizerTaskId = taskId;
    const normalizedEndTime = normalizeEndTime(endTime);
    const slackTaskId = `send_slack_message-${meetingId}-${normalizedEndTime}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
    
    let summarizerTask: any = null;
    let slackTask: any = null;
    
    try {
      summarizerTask = await loadFn(summarizerTaskId);
    } catch (e) {
      // Summarizer task doesn't exist yet
    }
    
    try {
      slackTask = await loadFn(slackTaskId);
    } catch (e) {
      // Slack task doesn't exist yet
    }

    const getTaskState = (task: any): string => {
      const stateRaw = task?.task?.status?.state || task?.status?.state || task?.state || '';
      return String(stateRaw).toLowerCase();
    };

    const summarizerState = getTaskState(summarizerTask);
    const slackState = getTaskState(slackTask);
    
    const summarizerDone = summarizerState === 'completed' || summarizerState === 'succeeded';
    const slackDone = slackState === 'completed' || slackState === 'succeeded';
    
    console.log('[idem] Task states', { 
      summarizer: { exists: !!summarizerTask, state: summarizerState, done: summarizerDone },
      slack: { exists: !!slackTask, state: slackState, done: slackDone }
    });

    // If both tasks are completed, it's a duplicate
    if (summarizerDone && slackDone) {
      console.warn('[idem] duplicate detected - both tasks completed', { summarizerTaskId, slackTaskId });
      return { isDuplicate: true, taskId };
    }

    // If summarizer is done but slack isn't, we can continue from slack
    if (summarizerDone && !slackDone) {
      console.log('[idem] can continue - summarizer done, slack pending', { summarizerTaskId, slackTaskId });
      return { isDuplicate: false, taskId, canContinue: true };
    }

    // If summarizer is not done, proceed normally
    return { isDuplicate: false, taskId };
  } catch (e) {
    console.error('[idem] TaskStore check failed', e);
    return { isDuplicate: false, taskId };
  }
}

export function normalizeEndTime(endTime: string): string {
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
