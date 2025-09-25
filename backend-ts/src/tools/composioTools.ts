import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { OpenAIToolSet } from 'composio-core';

const composioToolset = new OpenAIToolSet({ apiKey: process.env.COMPOSIO_API_KEY || '' });
const userId = process.env.COMPOSIO_ENTITY_ID || 'default_user';

async function executeComposioTool(toolName: string, args: Record<string, any>) {
  const toolCall = {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: 'function' as const,
    function: { name: toolName, arguments: JSON.stringify(args) },
  } as any;
  return (composioToolset as any).executeToolCall(toolCall, userId);
}

// Use an any-typed alias to avoid deep generic instantiation errors
const toolAny: any = tool as any;

export const slackSendMessage: any = toolAny(
  async (args: any) => {
    console.log('[tool] SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL invoked');
    const normalized: any = { ...args };
    if (!normalized.channel || typeof normalized.channel !== 'string' || normalized.channel.trim() === '') {
      normalized.channel = process.env.SLACK_DEFAULT_CHANNEL || 'C08KCHMGZV3';
    }
    if (typeof normalized.text !== 'string') normalized.text = String(normalized.text ?? '');
    console.log('[tool] slack params', { channel: normalized.channel, textPreview: String(normalized.text).slice(0, 120) });
    return executeComposioTool('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL', normalized);
  },
  {
    name: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
    description: 'Send a message to a Slack channel',
    schema: z.object({
      channel: z.string().nullable(),
      text: z.string(),
    }),
  }
);

export const slackTools: any = [slackSendMessage];


