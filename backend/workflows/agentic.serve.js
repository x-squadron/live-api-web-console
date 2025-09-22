import { z } from 'zod';
import { serve } from '@upstash/workflow';

export const AgenticInput = z.object({
  tenantId: z.string().min(1),
  sessionId: z.string().min(1),
  flowType: z.enum(['default', 'consultation', 'nonConsultation']).default('default'),
  payload: z.any().optional()
});

// Create the workflow using core serve function
const workflow = serve('agentic', async (context) => {
  const input = context.requestPayload;

  const workflowKey = `${input.tenantId}:${input.sessionId}:${input.flowType}`;

  await context.run('idempotency-check', async () => {
    const { acquire } = await import('./utils/idempotency.js');
    const ok = await acquire(workflowKey, context.runId);
    if (!ok) {
      context.log('duplicate-run', { workflowKey, runId: context.runId });
      return context.end({ status: 'duplicate_in_progress', runId: context.runId });
    }
  });

  const summary = await context.run('summary', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: input.payload?.transcript, text: input.payload?.text, meetingId: input.payload?.meetingId })
    });
    return res.json();
  });

  const analysis = await context.run('analysis', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetingId: input.payload?.meetingId, actionItems: summary?.result?.actionItems })
    });
    return res.json();
  });

  await context.sleep('delay', 500);

  const exec = await context.run('exec', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetingId: input.payload?.meetingId, analysis: analysis?.result?.analysis, userId: input.payload?.userId })
    });
    return res.json();
  });

  const persisted = await context.run('persist', async () => {
    const res = await fetch(`${process.env.PUBLIC_BASE_URL}/internal/workflow/persist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: input.payload?.jobId, data: { summary, analysis, exec }, status: 'completed' })
    });
    return res.json();
  });

  await context.run('finalize', async () => {
    const { done } = await import('./utils/idempotency.js');
    await done(workflowKey, context.runId);
  });

  return { status: 'ok', runId: context.runId, data: persisted };
}, {
  baseUrl: process.env.PUBLIC_BASE_URL || 'https://lasting-stingray-multiply.ngrok-free.app'
});

// Export as Express middleware that handles both trigger and step execution
export const agenticWorkflow = {
  POST: async (req, res) => {
    try {
      console.log('[Workflow] Received request:', {
        headers: req.headers,
        body: req.body,
        hasUpstashWorkflowRunId: !!req.headers['upstash-workflow-runid'],
        hasUpstashMessageId: !!req.headers['upstash-message-id']
      });

      // Check if this is a step execution request from Upstash Workflow
      if (req.headers['upstash-workflow-runid'] && req.headers['upstash-message-id']) {
        // This is a step execution request - handle it directly
        console.log('[Workflow] Handling step execution for run:', req.headers['upstash-workflow-runid']);
        
        // Decode the base64 body to get the actual payload
        let requestData = req.body;
        if (Array.isArray(req.body) && req.body.length > 0) {
          const firstElement = req.body[0];
          if (firstElement && typeof firstElement === 'object' && firstElement.body) {
            try {
              const decodedBody = Buffer.from(firstElement.body, 'base64').toString('utf-8');
              requestData = JSON.parse(decodedBody);
              console.log('[Workflow] Decoded step execution payload:', requestData);
            } catch (decodeError) {
              console.error('Failed to decode base64 body:', decodeError);
            }
          }
        }
        
        // Execute the workflow steps based on the step type
        const stepType = req.body[0]?.callType || 'unknown';
        console.log('[Workflow] Executing step type:', stepType);
        
        // For now, just return success - the actual step execution logic
        // should be handled by the workflow definition above
        res.json({ 
          success: true, 
          status: 'step_completed',
          runId: req.headers['upstash-workflow-runid'],
          stepType: stepType
        });
        return;
      } else {
        // This is a trigger request - start a new workflow
        console.log('[Workflow] Handling workflow trigger');
        
        // Parse the input
        const input = AgenticInput.parse(req.body);
        
        // Trigger the workflow using the client
        const { Client } = await import('@upstash/workflow');
        const client = new Client({ token: process.env.UPSTASH_WORKFLOW_TOKEN });
        
        const result = await client.trigger({
          url: `${process.env.PUBLIC_BASE_URL}/workflows/agentic`,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input)
        });
        
        res.json({ 
          success: true, 
          status: 'accepted', 
          runId: result.workflowRunId 
        });
      }
    } catch (error) {
      console.error('Workflow error:', error);
      res.status(500).json({ error: error.message });
    }
  }
};


