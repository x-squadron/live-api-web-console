import React, { useEffect, useState, ChangeEvent } from 'react';
import { useMCPToolsStore } from '../../lib/stores/mcpToolsStore';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './settings-dialog.scss';

export function MCPServerSelector() {
  const { servers, selectedServerId, selectServer, fetchServers } = useMCPToolsStore();
  const { connected } = useLiveAPIContext();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleServerChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const serverId = e.target.value;
    if (serverId) {
      setIsLoading(true);
      try {
        await selectServer(serverId);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="settings-section">
      <h3>MCP Server Selection</h3>
      <div className="select-wrapper">
        <select
          className="settings-select"
          value={selectedServerId || ""}
          onChange={handleServerChange}
          disabled={connected || isLoading}
        >
          <option value="">Select an MCP Server</option>
          {servers.map((server) => (
            <option key={`server-${server.id}`} value={server.id}>
              {server.name}
            </option>
          ))}
        </select>
        {isLoading && <div className="loading-spinner" />}
      </div>
      {selectedServerId && (
        <div className="server-description">
          {servers.find(s => s.id === selectedServerId)?.description}
        </div>
      )}
    </div>
  );
} 