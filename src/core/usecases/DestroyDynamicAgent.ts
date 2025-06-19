import { Usecase } from "./Usecase";
import { RealAgentManager } from "../../agents/RealAgentManager";

export interface DestroyDynamicAgentInputPort {
  appName?: string;
  agentId?: string;
}

export interface DestroyDynamicAgentOutputPort {
  onSuccess: (destroyedCount: number) => void;
  onError: (error: Error) => void;
}

export class DestroyDynamicAgent implements Usecase<DestroyDynamicAgentInputPort, DestroyDynamicAgentOutputPort, number> {
  private agentManager: RealAgentManager;

  constructor() {
    this.agentManager = RealAgentManager.getInstance();
    console.log(`[DestroyDynamicAgent] Using Real backend`);
  }

  async execute(
    inputs: DestroyDynamicAgentInputPort, 
    outputs?: DestroyDynamicAgentOutputPort
  ): Promise<number> {
    console.log(`[DestroyDynamicAgent] Destroying agents for:`, inputs);

    try {
      // Validate inputs - must have either appName or agentId
      if (!inputs.appName && !inputs.agentId) {
        throw new Error('Either appName or agentId must be provided');
      }

      let destroyedCount = 0;

      if (inputs.agentId) {
        // Destroy specific agent by ID
        const success = await this.agentManager.destroyAgent(inputs.agentId);
        destroyedCount = success ? 1 : 0;
        
        if (success) {
          console.log(`[DestroyDynamicAgent] Successfully destroyed agent ${inputs.agentId}`);
        } else {
          console.warn(`[DestroyDynamicAgent] Agent ${inputs.agentId} not found or failed to destroy`);
        }
      } else if (inputs.appName) {
        // Destroy all agents for the app
        destroyedCount = await this.agentManager.destroyAgentsByApp(inputs.appName);
        console.log(`[DestroyDynamicAgent] Successfully destroyed ${destroyedCount} agents for app ${inputs.appName}`);
      }

      // Notify success
      outputs?.onSuccess(destroyedCount);
      
      return destroyedCount;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(`[DestroyDynamicAgent] Failed to destroy agents:`, errorObj);
      
      // Notify error
      outputs?.onError(errorObj);
      
      throw errorObj;
    }
  }
} 