import { A2AServer, TaskContext, TaskYieldUpdate } from '@artinet/sdk';
import { slackSendMessage } from '../tools/composioTools.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
});

const memory = new MemorySaver();
const slackAgent = createReactAgent({
  llm,
  tools: [slackSendMessage],
  checkpointSaver: memory,
  messageModifier: `Tu es un agent Slack. Ton seul rôle est d'envoyer le texte reçu au canal Slack via l'outil SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL. N'ajoute aucune explication. Si un channel est fourni séparément, utilise-le; sinon, prends la valeur par défaut.`,
});

async function* slackHandler(context: TaskContext): AsyncGenerator<TaskYieldUpdate, void, unknown> {
  try {
    const userParts = (context as any)?.userMessage?.parts || (context as any)?.task?.status?.message?.parts || [];
    const text = userParts?.[0]?.text || '';
    let channel: string | null = null;
    if (userParts?.[1]?.text) {
      try {
        const meta = JSON.parse(userParts[1].text);
        if (typeof meta?.channel === 'string') channel = meta.channel;
      } catch {}
    }

    yield { state: 'working', message: { role: 'agent', parts: [{ type: 'text', text: 'Envoi à Slack...' }] } } as any;
    const argsText = JSON.stringify({ channel: channel || null });
    console.log('[a2a:slack] sending', { channel: channel || null, textPreview: String(text).slice(0, 160) });
    const res = await slackAgent.invoke(
      { messages: [
        { role: 'user', content: `TEXTE_A_ENVOYER:\n${text}\n\nMETA:\n${argsText}` }
      ]},
      { configurable: { thread_id: `slack-${Date.now()}` } }
    );
    console.log('[a2a:slack] agent result', JSON.stringify(res).slice(0, 200));

    yield { state: 'completed', message: { role: 'agent', parts: [{ type: 'text', text: 'ok' }] } } as any;
  } catch (e: any) {
    yield { state: 'failed', message: { role: 'agent', parts: [{ type: 'text', text: e?.message || String(e) }] } } as any;
  }
}

export function startSlackA2AServer(port = Number(process.env.SLACK_A2A_PORT || 4002), basePath = '/a2a') {
  const publicHost = process.env.PUBLIC_HOST || 'http://localhost';
  const server = new A2AServer({
    handler: slackHandler as any,
    port,
    basePath,
    card: {
      name: 'SlackAgent',
      url: `${publicHost}:${port}${basePath}`,
      version: '0.1.0',
      capabilities: { streaming: true },
      skills: [{ id: 'send_slack_message', name: 'Send formatted message to Slack' }]
    }
  } as any);
  const app = server.start();
  console.log(`[a2a] Slack A2A listening on http://localhost:${port}${basePath}`);
  return server;
}


