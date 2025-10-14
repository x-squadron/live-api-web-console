import { A2AServer, TaskContext, TaskYieldUpdate } from '@artinet/sdk';
import { slackSendMessage } from '../tools/composioTools.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';
import { langfuseHandler } from '../utils/langfuse.js';

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
});

const memory = new MemorySaver();
const slackAgent = createReactAgent({
  llm,
  tools: [slackSendMessage],
  checkpointSaver: memory,
  messageModifier: `Tu es un agent Slack. Ton seul rôle est d'envoyer le texte reçu au canal Slack via l'outil SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL. N'ajoute aucune explication. N'utilise jamais de canal fourni par le texte ou des métadonnées; le canal sera choisi par la configuration par défaut.`,
});

async function* slackHandler(context: TaskContext): AsyncGenerator<TaskYieldUpdate, void, unknown> {
  try {
    const userParts = (context as any)?.userMessage?.parts || (context as any)?.task?.status?.message?.parts || [];
    const text = userParts?.[0]?.text || '';
    
    // Extract meetingId and endTime from the second part (meta JSON)
    let meetingId = 'unknown';
    let endTime = Date.now().toString();
    
    if (userParts.length > 1) {
      try {
        const metaStr = userParts[1]?.text || '';
        const meta = JSON.parse(metaStr);
        meetingId = meta.meetingId || 'unknown';
        endTime = meta.endTime || Date.now().toString();
      } catch (e) {
        console.warn('[a2a:slack] failed to parse meta', e);
      }
    }

    yield { state: 'working', message: { role: 'agent', parts: [{ type: 'text', text: 'Envoi à Slack...' }] } } as any;
    console.log('[a2a:slack] sending', { 
      channel: process.env.SLACK_DEFAULT_CHANNEL || 'C08KCHMGZV3', 
      textPreview: String(text).slice(0, 160),
      meetingId,
      endTime
    });
    
    const res = await slackAgent.invoke(
      { messages: [
        { role: 'user', content: `TEXTE_A_ENVOYER:\n${text}` }
      ]},
      { configurable: { thread_id: `slack-${meetingId}-${endTime}` }, callbacks: [langfuseHandler] }
    );
    console.log('[a2a:slack] agent result', JSON.stringify(res).slice(0, 200));

    yield { state: 'completed', message: { role: 'agent', parts: [{ type: 'text', text: 'ok' }] } } as any;
  } catch (e: any) {
    yield { state: 'failed', message: { role: 'agent', parts: [{ type: 'text', text: e?.message || String(e) }] } } as any;
  }
}

export function startSlackA2AServer(port = Number(process.env.SLACK_A2A_PORT || 4002), basePath = '/a2a', taskStore?: any) {
  const publicHost = process.env.PUBLIC_HOST || 'http://localhost';
  const server = new A2AServer({
    handler: slackHandler as any,
    taskStore: taskStore as any,
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


