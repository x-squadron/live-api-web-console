import 'dotenv/config';
// Initialize OpenTelemetry before any other imports
import './utils/openTelemetry.js';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { A2AClient } from '@artinet/sdk';
import { startSummarizerA2AServer } from './a2a/summarizerAgent.js';
import { startSlackA2AServer } from './a2a/slackAgent.js';
import { taskStore } from './services/taskStore.js';
import { AgentRegistry } from './a2a/registry.js';
import { checkIdempotency, checkTaskStoreIdempotency } from './utils/idempotency.js';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

const PayloadSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  platform: z.string(),
  native_meeting_id: z.string(),
  constructed_meeting_url: z.string().url(),
  status: z.string(),
  bot_container_id: z.string(),
  connection_id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  data: z.record(z.any()),
  created_at: z.string(),
  updated_at: z.string(),
  text: z.string().optional(),
  transcript_generated_at: z.string().optional()
});


app.post('/api/multi-swarm/process-transcript-workflow', async (req: Request, res: Response) => {
  console.log('[api] POST /api/multi-swarm/process-transcript-workflow received', {
    bodyKeys: Object.keys(req.body || {}),
    native_meeting_id: (req.body as any)?.native_meeting_id,
  });
  
  const parse = PayloadSchema.safeParse(req.body);
  if (!parse.success) {
    console.warn('[api] payload validation failed', parse.error.flatten());
    return res.status(400).json({ success: false, error: parse.error.flatten() });
  }

  try {
    const meetingId = String(parse.data.native_meeting_id || parse.data.id);
    const endTime = String(parse.data.end_time || '');
    
    // Independent checks: TaskStore and Redis
    const { isDuplicate: isTS, idempotencyKey: idemTS, taskId } = await checkTaskStoreIdempotency(meetingId, endTime);
    if (isTS) {
      return res.status(409).json({ success: false, error: 'duplicate_taskstore', idempotencyKey: idemTS });
    }

    /* const { isDuplicate: isRedis, idempotencyKey: idemRedis } = await checkIdempotency(meetingId, endTime);
    if (isRedis) {
      return res.status(409).json({ success: false, error: 'duplicate_redis', idempotencyKey: idemRedis });
    } */

    // Return 202 immediately after idempotency check passes
    res.status(202).json({ success: true, accepted: true });

    // Fire-and-forget A2A call to Summarizer
    const payload = parse.data;
    const summarizerUrl = process.env.SUMMARIZER_A2A_URL || `${process.env.PUBLIC_HOST || 'http://localhost'}:${process.env.SUMMARIZER_A2A_PORT || 4001}/a2a`;
    const client = new A2AClient(summarizerUrl);
    
    setImmediate(() => {
      client
        .sendTask({
          // Deterministic, filesystem-safe task id
          id: taskId,
          message: {
            role: 'user',
            parts: [
              { type: 'text', text: JSON.stringify({ meetingId, url: payload.constructed_meeting_url, transcript: payload.text || '' }) }
            ]
          }
        } as any)
        .catch((e: any) => console.error('[api] summarizer A2A error (async)', e));
    });
    
    return;
  } catch (e: any) {
    console.error('[api] request processing failed', e);
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});
 
const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  console.log(`[summary-service] listening on :${port}`);
});

// Start A2A agent servers with shared in-memory task store
startSummarizerA2AServer(undefined, undefined, taskStore);
startSlackA2AServer(undefined, undefined, taskStore);

// Build registry of known agents for dynamic discovery
const publicHost = process.env.PUBLIC_HOST || 'http://localhost';
const summarizerUrl = process.env.SUMMARIZER_A2A_URL || `${publicHost}:${process.env.SUMMARIZER_A2A_PORT || 4001}/a2a`;
const slackUrl = process.env.SLACK_A2A_URL || `${publicHost}:${process.env.SLACK_A2A_PORT || 4002}/a2a`;
export const agentRegistry = new AgentRegistry([summarizerUrl, slackUrl]);
agentRegistry.refresh().then(() => console.log('[registry] loaded')).catch(() => {});


