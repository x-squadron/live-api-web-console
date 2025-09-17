import { z } from 'zod';
import { serve, step, sleep } from '@upstash/workflow';

export const AgenticInput = z.object({
  tenantId: z.string().min(1),
  sessionId: z.string().min(1),
  flowType: z.enum(['default', 'consultation', 'nonConsultation']).default('default'),
  payload: z.any().optional()
});

export default serve('agentic', async (ctx) => {
  const input = AgenticInput.parse(ctx.requestPayload);

  const workflowKey = `${input.tenantId}:${input.sessionId}:${input.flowType}`;

  await step('idempotency-check', async () => {
    const { acquire } = await import('./utils/idempotency.js');
    const ok = await acquire(workflowKey, ctx.runId);
    if (!ok) {
      ctx.log('duplicate-run', { workflowKey, runId: ctx.runId });
      return ctx.end({ status: 'duplicate_in_progress', runId: ctx.runId });
    }
  });

  const summary = await step('summary', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: input.payload?.transcript, text: input.payload?.text, meetingId: input.payload?.meetingId })
    });
    return res.json();
  });

  const analysis = await step('analysis', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetingId: input.payload?.meetingId, actionItems: summary?.result?.actionItems })
    });
    return res.json();
  });

  await sleep(500);

  const exec = await step('exec', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetingId: input.payload?.meetingId, analysis: analysis?.result?.analysis, userId: input.payload?.userId })
    });
    return res.json();
  });

  const persisted = await step('persist', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/persist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: input.payload?.jobId, data: { summary, analysis, exec }, status: 'completed' })
    });
    return res.json();
  });

  await step('finalize', async () => {
    const { done } = await import('./utils/idempotency.js');
    await done(workflowKey, ctx.runId);
  });

  return { status: 'ok', runId: ctx.runId, data: persisted };
}, {
  flowControl: {
    key: (payload) => {
      const p = AgenticInput.safeParse(payload);
      const tenantId = p.success ? p.data.tenantId : 'global';
      return `agentic:${tenantId}`;
    },
    parallelism: 1
  },
  retries: {
    attempts: 3,
    backoff: { type: 'exponential', initialDelay: 1000, factor: 2, maxDelay: 15000 }
  }
});


