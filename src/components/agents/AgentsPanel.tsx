import { useEffect, useState } from "react";

// Define the Agent type
type Agent = {
  id: string;
  name: string;
  appName: string;
  description: string;
  url: string;
  actions: string[];
  created: string;
  discoverable?: boolean;
};

type AgentsPanelProps = {
  onClose: () => void;
};

export default function AgentsPanel({ onClose }: AgentsPanelProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch ALL agents (including undiscoverable ones) for the management panel
    fetch("/api/agents?includeUndiscoverable=true")
      .then(res => res.json())
      .then(data => {
        console.log("Fetched agents:", data.agents);
        setAgents(data.agents || []);
      })
      .catch(error => {
        console.error("Error fetching agents:", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleDiscoverable = async (agent: Agent) => {
    // Prevent multiple simultaneous toggles for the same agent
    if (toggling.has(agent.id)) return;

    setToggling(prev => new Set(prev).add(agent.id));
    
    try {
      console.log(`Toggling discoverable status for agent ${agent.id} (currently: ${agent.discoverable})`);
      
      const response = await fetch(`/api/agents/${agent.id}/toggle-discoverable`, { 
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Toggle response:`, result);
      
      if (result.success) {
        // Update the agent's discoverable status
        setAgents(agents =>
          agents.map(a =>
            a.id === agent.id ? { ...a, discoverable: result.discoverable } : a
          )
        );
        console.log(`Agent ${agent.id} discoverable status updated to: ${result.discoverable}`);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error(`Error toggling agent ${agent.id}:`, error);
      // Show an error message or revert the UI state
      alert(`Failed to toggle agent status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setToggling(prev => {
        const newSet = new Set(prev);
        newSet.delete(agent.id);
        return newSet;
      });
    }
  };

  return (
    <div>
      <button onClick={onClose} style={{ float: "right" }}>✕</button>
      <h2>Agents</h2>
      {loading ? <div>Loading...</div> : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {agents.map(agent => {
            const isToggling = toggling.has(agent.id);
            return (
              <li key={agent.id} style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{agent.name} <span style={{ color: '#888', fontWeight: 400 }}>({agent.appName})</span></div>
                  <div style={{ fontSize: 12, color: '#888' }}>{agent.description}</div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: isToggling ? 0.6 : 1 }}>
                  <input
                    type="checkbox"
                    checked={agent.discoverable !== false}
                    onChange={() => toggleDiscoverable(agent)}
                    disabled={isToggling}
                  />
                  {isToggling ? "Updating..." : (agent.discoverable !== false ? "Online" : "Offline")}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
} 