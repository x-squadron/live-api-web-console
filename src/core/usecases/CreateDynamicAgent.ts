import { Usecase } from "./Usecase";
import { RealAgentManager } from "../../agents/RealAgentManager";
import { CreateAgentRequest, AgentInfo } from "../../a2a/types";

export interface CreateDynamicAgentInputPort {
  appName: string;
  toolNames: string[];
  systemPrompt?: string;
}

export interface CreateDynamicAgentOutputPort {
  onSuccess: (agentInfo: AgentInfo) => void;
  onError: (error: Error) => void;
}

export class CreateDynamicAgent implements Usecase<CreateDynamicAgentInputPort, CreateDynamicAgentOutputPort, AgentInfo> {
  private agentManager: RealAgentManager;

  constructor() {
    this.agentManager = RealAgentManager.getInstance();
    console.log(`[CreateDynamicAgent] Using Real backend`);
  }

  async execute(
    inputs: CreateDynamicAgentInputPort, 
    outputs?: CreateDynamicAgentOutputPort
  ): Promise<AgentInfo> {
    console.log(`[CreateDynamicAgent] Creating agent for ${inputs.appName} with tools:`, inputs.toolNames);

    try {
      // Validate inputs
      if (!inputs.appName || inputs.appName.trim() === '') {
        throw new Error('App name is required');
      }

      if (!inputs.toolNames || inputs.toolNames.length === 0) {
        throw new Error('At least one tool is required');
      }
      
      // Create agent request
      const request: CreateAgentRequest = {
        appName: inputs.appName,
        toolNames: inputs.toolNames,
        systemPrompt: inputs.systemPrompt
      };

      // Create the agent
      const agentInfo = await this.agentManager.createAgent(request);

      console.log(`[CreateDynamicAgent] Successfully created agent ${agentInfo.id} for ${inputs.appName}`);
      
      // Notify success
      outputs?.onSuccess(agentInfo);
      
      return agentInfo;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(`[CreateDynamicAgent] Failed to create agent for ${inputs.appName}:`, errorObj);
      
      // Notify error
      outputs?.onError(errorObj);
      
      throw errorObj;
    }
  }
} 