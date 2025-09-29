import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { A2AClient } from '@artinet/sdk';

// Removed discoverAgentUrlBySkill - now using A2A_DISCOVER_AGENTS tool instead

const toolAny: any = tool as any;

export const a2aDiscoverAgents: any = toolAny(
  async () => {
    const sourcesEnv = process.env.AGENT_DISCOVERY_SOURCES || '';
    const sources = sourcesEnv.split(',').map(s => s.trim()).filter(Boolean);
    const publicHost = process.env.PUBLIC_HOST || 'http://localhost';
    const defaults = [
      `${publicHost}:${process.env.SUMMARIZER_A2A_PORT || 4001}/a2a`,
      `${publicHost}:${process.env.SLACK_A2A_PORT || 4002}/a2a`,
    ];
    const candidates = [...new Set([...sources, ...defaults])];

    const discoveredAgents: any[] = [];
    
    for (const base of candidates) {
      try {
        const res = await fetch(new URL('/.well-known/agent.json', base).toString());
        if (!res.ok) continue;
        const card = await res.json();
        const skills = Array.isArray(card?.skills) ? card.skills : [];
        
        discoveredAgents.push({
          name: card?.name || 'Unknown Agent',
          url: card?.url || base,
          skills: skills.map((s: any) => ({
            id: s?.id,
            name: s?.name || s?.id,
            description: s?.description || 'No description available'
          }))
        });
      } catch (e) {
        // Skip failed discoveries
      }
    }

    try { console.log('[tool:a2a] discovered agents', { count: discoveredAgents.length, agents: discoveredAgents.map(a => ({ name: a.name, skillCount: a.skills.length })) }); } catch {}
    
    return JSON.stringify({
      agents: discoveredAgents,
      total: discoveredAgents.length,
      skills: discoveredAgents.flatMap(a => a.skills)
    }, null, 2);
  },
  {
    name: 'A2A_DISCOVER_AGENTS',
    description: 'Discover all available A2A agents and their skills. Use this to find the right skill_id before calling A2A_SEND_TASK_BY_SKILL.',
    schema: z.object({})
  }
);

export const a2aSendTaskBySkill: any = toolAny(
  async ({ skill_id, text, meta, agent_url }: any) => {
    // Agent must provide the URL from A2A_DISCOVER_AGENTS - no fallbacks
    if (!agent_url) {
      throw new Error(`Missing agent_url for skill '${skill_id}'. Use A2A_DISCOVER_AGENTS first to get the correct URL.`);
    }

    try { console.log('[tool:a2a] using discovered URL', { skill_id, agent_url }); } catch {}

    let metaObj: any = {};
    if (typeof meta === 'string') {
      try { metaObj = JSON.parse(meta); } catch { metaObj = {}; }
    } else if (meta && typeof meta === 'object') {
      metaObj = meta;
    }

    const client = new A2AClient(agent_url);
    const textStr = String(text ?? '');
    try { console.log('[tool:a2a] sendTask', { skill_id, agent_url, textLength: textStr.length, meta: { channel: metaObj?.channel ?? null } }); } catch {}

    try {
      const resp: any = await client.sendTask({
        id: `tool-${skill_id}-${Date.now()}`,
        message: {
          role: 'user',
          parts: [
            { type: 'text', text: textStr },
            { type: 'text', text: JSON.stringify(metaObj) },
          ]
        }
      } as any);

      const out = resp?.message?.parts?.find((p: any) => p?.type === 'text')?.text
        || resp?.status?.message?.parts?.find((p: any) => p?.type === 'text')?.text
        || 'ok';
      try { console.log('[tool:a2a] response', { skill_id, outPreview: String(out).slice(0, 200) }); } catch {}
      return out;
    } catch (e: any) {
      try { console.error('[tool:a2a] error', { skill_id, agent_url, error: e?.message || String(e) }); } catch {}
      throw e;
    }
  },
  {
    name: 'A2A_SEND_TASK_BY_SKILL',
    description: 'Send a task to another agent using the URL from A2A_DISCOVER_AGENTS. Call A2A_DISCOVER_AGENTS first to get the agent_url.',
    schema: z.object({
      skill_id: z.string().describe('The target agent skill id (e.g., send_slack_message)'),
      agent_url: z.string().describe('The agent URL from A2A_DISCOVER_AGENTS (e.g., http://localhost:4002/a2a)'),
      text: z.string().describe('Main text payload to send'),
      meta: z.union([z.string(), z.record(z.any())]).optional().describe('Additional JSON metadata (e.g., {"channel":"C08..."})')
    })
  }
);


