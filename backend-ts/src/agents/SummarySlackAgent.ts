import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { slackTools } from '../tools/composioTools.js';

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `Tu es un agent de résumé de réunion.
Objectif: lire le transcript et produire un résumé structuré EXACTEMENT dans cet ordre, puis l'envoyer sur Slack avec l'outil fourni.

Exigences de format (strict):
📌 Key takeaways\n
- Commence par: "Voici une analyse de la réunion :"
- Rédige 2–5 paragraphes courts et précis sur décisions, avancées, problèmes.

✅ Action items\n
- Liste à puces; chaque item commence par le nom complet, deux-points, puis l'action à l'infinitif.

💬 Small talk\n
- Écris "None" s'il n'y en a pas.

🧭 Summary\n
- Ajoute un titre: "Résumé de la Réunion : <thème>"
- Utilise des sous-sections thématiques (ex: "Contexte", "Identification des Locuteurs")
- Sous chaque thème, des puces courtes; inclure des timestamps si présents (ex: 02:01)

Règles:
- Le message envoyé sur Slack est en FRANÇAIS (même si le transcript est en anglais).
- Ton professionnel et concis, sans redondance.
- Inclure l'ID de la réunion et l'URL si fournie (dans la section Summary / Contexte).
- À la fin, APPELLE l'outil Slack pour envoyer le texte (plain text; pas de blocks).
`;

const memory = new MemorySaver();

export const summarySlackAgent: any = createReactAgent({
  llm,
  tools: [...slackTools],
  checkpointSaver: memory,
  messageModifier: systemPrompt,
});

export async function runSummarySlackAgent(params: { meetingId: string; url?: string; transcript: string }) {
  const { meetingId, url, transcript } = params;

  const userPrompt = `MEETING ID: ${meetingId}
${url ? `MEETING URL: ${url}\n` : ''}

TRANSCRIPT:
${transcript}

Tâche:
1) Produire le résumé structuré EXACTEMENT selon le format ci-dessus (titres avec emojis inclus).
2) L'envoyer sur Slack avec l'outil Slack (utiliser le canal par défaut si non précisé).`;

  function resolveToolName(tool: any): string {
    try {
      if (tool?.name && typeof tool.name === 'string') return tool.name;
      if (tool?.constructor?.name && tool.constructor.name !== 'Object') return tool.constructor.name;
      // Serialized tool objects often include an id array
      const id = (tool && (tool.id || tool.kwargs?.id)) as any;
      if (Array.isArray(id) && id.length > 0) return id[id.length - 1];
      // Some wrappers keep a nested name
      const nested = tool?.kwargs?.name || tool?.lc_serializable?.name;
      if (typeof nested === 'string') return nested;
    } catch {}
    return 'unknown';
  }

  const callbacks: any = [{
    handleLLMStart: (_llm: any, prompts: any) => {
      console.log('[agent] LLM start');
      try { console.log('[agent] prompts:', JSON.stringify(prompts, null, 2)); } catch {}
    },
    handleLLMEnd: (output: any) => {
      console.log('[agent] LLM end');
      try {
        const text = output?.generations?.[0]?.[0]?.text ?? output?.output_text ?? '';
        if (text) console.log('[agent] draft length:', String(text).length);
      } catch {}
    },
    handleToolStart: (tool: any, input: any) => {
      const name = resolveToolName(tool);
      console.log('[agent] Tool start:', name);
      try {
        console.log('[agent] tool input:', typeof input === 'string' ? input.slice(0, 400) : JSON.stringify(input).slice(0, 400));
      } catch {}
    },
    handleToolEnd: (output: any) => {
      console.log('[agent] Tool end');
      try { console.log('[agent] tool output:', JSON.stringify(output).slice(0, 400)); } catch {}
    },
    handleChainError: (e: any) => { console.error('[agent] error:', e?.message || e); },
  }];

  const result = await summarySlackAgent.invoke(
    { messages: [{ role: 'user', content: userPrompt }] },
    { configurable: { thread_id: meetingId }, callbacks }
  );
  return result;
}


