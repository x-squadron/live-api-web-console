import { create } from 'zustand';
import { MCPServer, MCPTool, composioService } from '../composioClient';

interface MCPToolsState {
  servers: MCPServer[];
  selectedServerId: string | null;
  tools: MCPTool[];
  isLoading: boolean;
  error: string | null;
  fetchServers: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
}

export const useMCPToolsStore = create<MCPToolsState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  tools: [],
  isLoading: false,
  error: null,

  fetchServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const servers = await composioService.getAvailableIntegrations();
      set({ 
        servers, 
        isLoading: false,
        // Clear tools when fetching new servers
        tools: [],
        selectedServerId: null
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch servers',
        isLoading: false,
        servers: [],
        tools: [],
        selectedServerId: null
      });
    }
  },

  selectServer: async (serverId: string) => {
    set({ isLoading: true, error: null, selectedServerId: serverId });
    try {
      const tools = await composioService.getToolsForIntegration(serverId);
      set({ 
        tools, 
        isLoading: false,
        error: tools.length === 0 ? 'No tools available for this integration' : null
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch tools',
        isLoading: false,
        tools: [],
        selectedServerId: null
      });
    }
  },
})); 