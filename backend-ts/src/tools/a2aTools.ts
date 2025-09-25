import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { A2AClient } from '@artinet/sdk';

async function discoverAgentUrlBySkill(skillId: string): Promise<string | undefined> {
  const sourcesEnv = process.env.AGENT_DISCOVERY_SOURCES || '';
  const sources = sourcesEnv.split(',').map(s => s.trim()).filter(Boolean);
  const publicHost = process.env.PUBLIC_HOST || 'http://localhost';
  const defaults = [
    `${publicHost}:${process.env.SUMMARIZER_A2A_PORT || 4001}/a2a`,
    `${publicHost}:${process.env.SLACK_A2A_PORT || 4002}/a2a`,
  ];
  const candidates = [...new Set([...sources, ...defaults])];

  for (const base of candidates) {
    try {
      const res = await fetch(new URL('/.well-known/agent.json', base).toString());
      if (!res.ok) continue;
      const card = await res.json();
      const skills = Array.isArray(card?.skills) ? card.skills : [];
      if (skills.some((s: any) => s?.id === skillId)) {
        return card?.url || base;
      }
    } catch {}
  }
  return undefined;
}

const toolAny: any = tool as any;

export const a2aSendTaskBySkill: any = toolAny(
  async ({ skill_id, text, meta }: any) => {
    const resolved = await discoverAgentUrlBySkill(skill_id);
    const fallback = skill_id === 'send_slack_message'
      ? (process.env.SLACK_A2A_URL || `${process.env.PUBLIC_HOST || 'http://localhost'}:${process.env.SLACK_A2A_PORT || 4002}/a2a`)
      : undefined;

    const url = resolved || fallback;
    if (!url) throw new Error(`No agent found for skill '${skill_id}'`);

    let metaObj: any = {};
    if (typeof meta === 'string') {
      try { metaObj = JSON.parse(meta); } catch { metaObj = {}; }
    } else if (meta && typeof meta === 'object') {
      metaObj = meta;
    }

    const client = new A2AClient(url);
    const resp: any = await client.sendTask({
      id: `tool-${skill_id}-${Date.now()}`,
      message: {
        role: 'user',
        parts: [
          { type: 'text', text: String(text ?? '') },
          { type: 'text', text: JSON.stringify(metaObj) },
        ]
      }
    } as any);

    const out = resp?.message?.parts?.find((p: any) => p?.type === 'text')?.text
      || resp?.status?.message?.parts?.find((p: any) => p?.type === 'text')?.text
      || 'ok';
    return out;
  },
  {
    name: 'A2A_SEND_TASK_BY_SKILL',
    description: 'Send a task to another agent discovered by skill id (dynamic A2A).',
    schema: z.object({
      skill_id: z.string().describe('The target agent skill id (e.g., send_slack_message)'),
      text: z.string().describe('Main text payload to send'),
      meta: z.union([z.string(), z.record(z.any())]).optional().describe('Additional JSON metadata (e.g., {"channel":"C08..."})')
    })
  }
);


