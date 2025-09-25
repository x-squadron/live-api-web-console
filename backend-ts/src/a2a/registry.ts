type AgentCard = {
  name: string;
  url: string;
  version?: string;
  capabilities?: Record<string, any>;
  skills?: Array<{ id: string; name?: string }>; 
};

export class AgentRegistry {
  private skillToAgentUrl: Map<string, string> = new Map();
  private sources: string[];

  constructor(sources: string[]) {
    this.sources = sources;
  }

  async refresh(): Promise<void> {
    for (const src of this.sources) {
      try {
        const res = await fetch(new URL('/.well-known/agent.json', src).toString());
        if (!res.ok) continue;
        const card: AgentCard = await res.json();
        const skills = card?.skills || [];
        for (const s of skills) {
          if (s?.id && card?.url) {
            this.skillToAgentUrl.set(s.id, card.url);
          }
        }
      } catch (e) {
        // ignore individual failures
      }
    }
  }

  resolveBySkill(skillId: string): string | undefined {
    return this.skillToAgentUrl.get(skillId);
  }
}



