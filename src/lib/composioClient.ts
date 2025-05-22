import { Composio } from 'composio-core';
import { SchemaType } from '@google/generative-ai';

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  parameters: {
    type: SchemaType;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  logo?: string;
}

class ComposioService {
  private client: Composio;
  private static instance: ComposioService;

  private constructor() {
    const apiKey = process.env.REACT_APP_COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error('Composio API key not found in environment variables');
    }

    this.client = new Composio({
      apiKey,
      baseUrl: 'https://backend.composio.dev',
    });
  }

  public static getInstance(): ComposioService {
    if (!ComposioService.instance) {
      ComposioService.instance = new ComposioService();
    }
    return ComposioService.instance;
  }

  public async getAvailableIntegrations(): Promise<MCPServer[]> {
    try {
      const response = await this.client.integrations.list();
      const integrations = response?.items || [];

      const enabledIntegrations = integrations.filter(
        (i: any) => i.enabled && !i.deleted && i.toolkitUUID
      );

      return enabledIntegrations.map((integration: any) => ({
        id: integration.toolkitUUID, // used later to fetch tools
        name: integration.appName || integration.name,
        description: integration.name || '',
        logo: integration.logo || '',
      }));
    } catch (error) {
      console.error('Error fetching available integrations:', error);
      return [];
    }
  }

  public async getToolsForIntegration(integrationId: string): Promise<MCPTool[]> {
    try {
      // First get the integration details to get the appName
      const integrations = await this.getAvailableIntegrations();
      const integration = integrations.find(i => i.id === integrationId);
      
      if (!integration) {
        console.error(`Integration ${integrationId} not found`);
        return [];
      }

      // Use the appName to fetch tools
      const response = await this.client.actions.list({ 
        apps: integration.name // Use the appName (which is stored in the name field)
      });
      const actions = response?.items || [];
      return actions.map((action: any) => ({
        id: action.id,
        name: action.name,
        description: action.description || '',
        parameters: {
          type: SchemaType.OBJECT,
          properties: action.parameters?.properties || {},
          required: action.parameters?.required || [],
        },
      }));
    } catch (error) {
      console.error(`Error fetching tools for integration ${integrationId}:`, error);
      return []; // Return empty array instead of throwing to handle gracefully
    }
  }

  public async executeTool(toolName: string, args: any): Promise<any> {
    try {
      // Execute the tool using the Composio client
      const response = await this.client.actions.execute({
        actionName: toolName,
        requestBody: args
      });
      return response;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }
}

export const composioService = ComposioService.getInstance();
