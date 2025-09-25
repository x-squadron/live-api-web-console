import { A2AServer, TaskContext, TaskYieldUpdate } from '@artinet/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { a2aSendTaskBySkill } from '../tools/a2aTools.js';

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
});

const system = `Tu es un agent de résumé. Produis un texte final en FRANÇAIS avec ces sections et emojis:
📌 Key takeaways
✅ Action items
💬 Small talk
🧭 Summary
Respecte le format, concis et professionnel.`;

function buildUserPrompt(meetingId: string, url: string | undefined, transcript: string): string {
  return `MEETING ID: ${meetingId}
${url ? `MEETING URL: ${url}\n` : ''}

TRANSCRIPT:\n${transcript}\n\nTâche: produire le résumé structuré EXACTEMENT selon le format et emojis.`;
}

const memory = new MemorySaver();
const summarizerAgent: any = createReactAgent({
  llm,
  tools: [a2aSendTaskBySkill as any],
  checkpointSaver: memory,
  messageModifier: system,
} as any);

async function* summarizerHandler(context: TaskContext): AsyncGenerator<TaskYieldUpdate, void, unknown> {
  try {
    const userParts = (context as any)?.userMessage?.parts || (context as any)?.task?.status?.message?.parts || (context as any)?.message?.parts || [];
    const firstText = userParts.find((p: any) => p?.type === 'text')?.text || '';
    const payload = JSON.parse(firstText || '{}');
    const meetingId = String(payload.meetingId || 'unknown');
    const url = payload.url as string | undefined;
    const transcript = String(payload.transcript || '');

    yield {
      state: 'working',
      message: { role: 'agent', parts: [{ type: 'text', text: 'Génération du résumé...' }] }
    } as any;

    const userPrompt = buildUserPrompt(meetingId, url, transcript);
    const res = await summarizerAgent.invoke(
      { messages: [{ role: 'user', content: userPrompt }] },
      { configurable: { thread_id: meetingId } }
    );
    const content = (res as any)?.messages?.at?.(-1)?.content
      || (res as any)?.output
      || (res as any)?.response
      || '';
    console.log('[a2a:summarizer] generated chars', (content?.length ?? 0));

    // Let the React agent optionally call A2A_SEND_TASK_BY_SKILL inside its reasoning
    // For deterministic behavior, also invoke Slack agent explicitly here using the tool
    try {
      const channel = process.env.SLACK_DEFAULT_CHANNEL || null;
      await (a2aSendTaskBySkill as any).invoke({
        skill_id: 'send_slack_message',
        text: String(content),
        meta: JSON.stringify({ channel })
      });
      console.log('[a2a:summarizer] delivered summary to Slack via A2A tool');
    } catch (e) {
      console.warn('[a2a:summarizer] slack delivery via tool failed:', (e as any)?.message || e);
    }

    yield {
      state: 'completed',
      message: { role: 'agent', parts: [{ type: 'text', text: String(content) }] }
    } as any;
  } catch (e: any) {
    yield { state: 'failed', message: { role: 'agent', parts: [{ type: 'text', text: e?.message || String(e) }] } } as any;
  }
}

export function startSummarizerA2AServer(port = Number(process.env.SUMMARIZER_A2A_PORT || 4001), basePath = '/a2a') {
  const publicHost = process.env.PUBLIC_HOST || 'http://localhost';
  const server = new A2AServer({
    handler: summarizerHandler as any,
    port,
    basePath,
    card: {
      name: 'SummarizerAgent',
      url: `${publicHost}:${port}${basePath}`,
      version: '0.1.0',
      capabilities: { streaming: true },
      skills: [{ id: 'meeting_summary', name: 'Generate meeting summary' }]
    }
  } as any);
  const app = server.start();
  console.log(`[a2a] Summarizer A2A listening on http://localhost:${port}${basePath}`);
  return server;
}


