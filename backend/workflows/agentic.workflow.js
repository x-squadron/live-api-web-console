import { z } from 'zod';

// Minimal client wrapper to trigger Upstash Workflow via REST API.
// Prefers UPSTASH_WORKFLOW_* but falls back to QSTASH_* for convenience.
const WORKFLOW_URL = (process.env.UPSTASH_WORKFLOW_URL || process.env.QSTASH_URL || '').trim();
const WORKFLOW_TOKEN = (process.env.UPSTASH_WORKFLOW_TOKEN || process.env.QSTASH_TOKEN || '').trim();

export const AgenticInput = z.object({
  tenantId: z.string().min(1),
  sessionId: z.string().min(1),
  flowType: z.enum(['default', 'consultation', 'nonConsultation']).default('default'),
  payload: z.any().optional()
});

async function trigger(payload, options = {}) {
  const input = AgenticInput.parse(payload);
  if (!WORKFLOW_URL || !WORKFLOW_TOKEN) {
    return { runId: null, accepted: false, reason: 'workflow_not_configured', input };
  }

  const base = WORKFLOW_URL.replace(/\/$/, '');
  const url = `${base}/v1/workflows/agentic/trigger`;
  const body = { ...input };
  if (options.label) {
    // Upstash Workflow supports labels on trigger body
    body.label = options.label;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Workflow trigger failed: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}

async function findRunsByLabel(label, { count = 1 } = {}) {
  if (!WORKFLOW_URL || !WORKFLOW_TOKEN) {
    return { runs: [] };
  }
  const base = WORKFLOW_URL.replace(/\/$/, '');
  const url = `${base}/v1/workflows/runs?label=${encodeURIComponent(label)}&count=${count}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`List runs failed: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({ runs: [] }));
}

export default { trigger, findRunsByLabel };