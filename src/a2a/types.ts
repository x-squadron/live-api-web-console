export interface AgentInfo {
  id: string;
  appName: string;
  name: string;
  description: string;
  url: string;
  port: number;
  tools: string[];
  server: any; // MockA2AServer for mock mode, null for API mode
  created: Date;
  lastUsed?: Date;
}

export interface AgentCard {
  name: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
  };
  skills: Array<{
    id: string;
    name: string;
  }>;
}

export interface CreateAgentRequest {
  appName: string;
  toolNames: string[];
  systemPrompt?: string;
  userId?: string;
}

export interface AgentDiscoveryResult {
  agents: Array<{
    id: string;
    name: string;
    description: string;
    url: string;
    appName: string;
    tools: string[];
    status: 'active' | 'inactive';
  }>;
}

export interface DelegateTaskRequest {
  agentId: string;
  message: string;
  userId?: string;
}

export interface DelegateTaskResponse {
  success: boolean;
  response?: string;
  error?: string;
} 