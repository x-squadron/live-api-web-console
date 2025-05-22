import React from 'react';
import { useMCPToolsStore } from '../../lib/stores/mcpToolsStore';
import './settings-dialog.scss';

export const MCPToolsList: React.FC = () => {
  const { tools, selectedServerId, isLoading } = useMCPToolsStore();

  if (!selectedServerId) {
    return null;
  }

  if (isLoading) {
    return <div className="loading-message">Loading tools...</div>;
  }

  if (tools.length === 0) {
    return <div className="no-tools-message">No tools available for this server.</div>;
  }

  return (
    <div className="settings-section">
      <h3>Available Tools</h3>
      <div className="tools-list">
        {tools.map((tool) => (
          <div key={tool.id} className="tool-item">
            <h4>{tool.name}</h4>
            <p className="tool-description">{tool.description}</p>
            <div className="tool-parameters">
              <h5>Parameters:</h5>
              <ul>
                {Object.entries(tool.parameters.properties).map(([name, prop]) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    {tool.parameters.required.includes(name) && ' (required)'}
                    <div className="parameter-type">Type: {prop.type}</div>
                    {prop.description && (
                      <div className="parameter-description">{prop.description}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 