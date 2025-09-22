import { z } from 'zod';
import { Client } from '@upstash/workflow';

// Create Upstash Workflow client with your QStash token
const client = new Client({
  token: process.env.UPSTASH_WORKFLOW_TOKEN || ''
});

export const AgenticInput = z.object({
  tenantId: z.string().min(1),
  sessionId: z.string().min(1),
  flowType: z.enum(['default', 'consultation', 'nonConsultation']).default('default'),
  payload: z.any().optional()
});

async function trigger(payload, options = {}) {
  const input = AgenticInput.parse(payload);
  
  if (!process.env.UPSTASH_WORKFLOW_TOKEN) {
    return { runId: null, accepted: false, reason: 'workflow_not_configured', input };
  }

  try {
    // Use ngrok endpoint for the workflow - full URL with path
    const workflowUrl = `${process.env.PUBLIC_BASE_URL}/workflows/agentic`;
    console.log('Triggering workflow at:', workflowUrl);
    
    const result = await client.trigger({
      url: workflowUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      ...options
    });
    
    return result;
  } catch (error) {
    console.error('Workflow trigger failed:', error);
    throw new Error(`Workflow trigger failed: ${error.message}`);
  }
}

async function findRunsByLabel(label, { count = 1 } = {}) {
  if (!process.env.UPSTASH_WORKFLOW_TOKEN) {
    return { runs: [] };
  }
  
  try {
    console.warn('findRunsByLabel: QStash V2 doesn\'t support label-based run listing');
    return { runs: [] };
  } catch (error) {
    console.error('Find runs by label failed:', error);
    return { runs: [] };
  }
}

export default { trigger, findRunsByLabel };