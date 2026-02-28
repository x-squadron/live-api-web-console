//composioAppList.tsx
import { useState, useMemo, useCallback } from "react";
import { ComposioToolSet } from "composio-core";
import "./composio-button.scss";
import { connectToApp } from "./connectToApp";
import { useSelectedToolsContext } from "../../liveagent";
import { useAppListViewModels } from "./viewmodels/useAppListViewModels";

export const COMPOSIO_ENTITY_ID =
  process.env.REACT_APP_COMPOSIO_API_KEY ?? "default";

export function ComposioAppList() {
  const {
    apps,
    categories,
    fetchToolsForApp,
    loading,
    loadingTools,
    connectionStatuses,
    setConnectionStatuses,
    toolsByApp,
    setToolsByApp,
    connectionIds,
    setConnectionIds,
    processingApps,
    setProcessingApps,
  } = useAppListViewModels(COMPOSIO_ENTITY_ID);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [connectionFilter, setConnectionFilter] = useState<
    "all" | "connected" | "not-connected"
  >("all");

  // New state for collapsible tool sections
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  // Use global context for selected tools and activation statuses
  const {
    selectedTools,
    setSelectedTools,
    activationStatuses,
    setActivationStatuses,
  } = useSelectedToolsContext();

  const toolset = useMemo(
    () =>
      new ComposioToolSet({
        apiKey: process.env.REACT_APP_COMPOSIO_API_KEY!,
      }),
    []
  );

  // Toggle app expansion
  const toggleAppExpansion = useCallback(
    async (appName: string) => {
      const isCurrentlyExpanded = expandedApps.has(appName);

      if (isCurrentlyExpanded) {
        // Collapse
        setExpandedApps((prev) => {
          const newSet = new Set(prev);
          newSet.delete(appName);
          return newSet;
        });
      } else {
        // Expand and fetch tools
        setExpandedApps((prev) => new Set(prev.add(appName)));
        await fetchToolsForApp(appName);
      }
    },
    [expandedApps, fetchToolsForApp]
  );

  // Toggle tool selection
  const toggleToolSelection = useCallback(
    (appName: string, toolName: string) => {
      setSelectedTools((prev) => {
        const newMap = new Map(prev);
        const appTools = new Set(newMap.get(appName)); // 👈 clone the Set

        if (appTools.has(toolName)) {
          appTools.delete(toolName);
        } else {
          appTools.add(toolName);
        }

        newMap.set(appName, appTools);
        return newMap;
      });
    },
    [setSelectedTools]
  );

  // Toggle app activation (for connected apps)
  const toggleAppActivation = useCallback(
    (appName: string) => {
      setActivationStatuses((prev) => {
        const newMap = new Map(prev);
        const currentStatus = newMap.get(appName) !== false; // default is true (activated)
        const newStatus = !currentStatus;

        newMap.set(appName, newStatus);

        console.log(`🔄 ${appName} ${newStatus ? "activated" : "deactivated"}`);

        // If deactivating, only collapse the tools section (preserve selectedTools)
        if (!newStatus) {
          // Collapse the app if it was expanded
          setExpandedApps((prevExpanded) => {
            const newSet = new Set(prevExpanded);
            newSet.delete(appName);
            return newSet;
          });

          console.log(
            `🧹 Collapsed tools section for deactivated app: ${appName} (selections preserved)`
          );
        }

        return newMap;
      });
    },
    [setActivationStatuses, setExpandedApps]
  );

  // Filter apps based on search, category, and connection status
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch = app.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || app.categories.includes(selectedCategory);

      const appConnectionStatus = connectionStatuses.get(app.name);
      const matchesConnection =
        connectionFilter === "all" ||
        (connectionFilter === "connected" &&
          appConnectionStatus === "ACTIVE") ||
        (connectionFilter === "not-connected" &&
          appConnectionStatus !== "ACTIVE");

      return matchesSearch && matchesCategory && matchesConnection;
    });
  }, [
    apps,
    searchTerm,
    selectedCategory,
    connectionFilter,
    connectionStatuses,
  ]);

  const handleConnect = async (appName: string) => {
    if (processingApps.has(appName)) return;

    setProcessingApps((prev) => new Set(prev.add(appName)));

    try {
      const success = await connectToApp(
        appName.toLowerCase(),
        COMPOSIO_ENTITY_ID
      );

      if (success) {
        const entity = await toolset.getEntity(COMPOSIO_ENTITY_ID);
        const connection = await entity.getConnection({
          app: appName.toLowerCase(),
        });

        // ✅ Update connection status
        setConnectionStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(appName, "ACTIVE");
          return newMap;
        });

        // ✅ Activate app by default
        setActivationStatuses((prev) => {
          const newMap = new Map(prev);
          if (!newMap.has(appName)) {
            newMap.set(appName, true);
          }
          return newMap;
        });

        // ✅ Store connection ID
        if (connection?.id) {
          setConnectionIds((prev) => {
            const newMap = new Map(prev);
            newMap.set(appName, connection.id);
            return newMap;
          });
          console.log(`✅ Connected to ${appName} with ID: ${connection.id}`);
        }
      } else {
        console.log(`❌ Connection failed or canceled for ${appName}`);
        setConnectionStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(appName, "INACTIVE");
          return newMap;
        });
      }
    } catch (error) {
      console.error(`❌ Error during connection flow for ${appName}:`, error);
      setConnectionStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(appName, "INACTIVE");
        return newMap;
      });
    } finally {
      setProcessingApps((prev) => {
        const newSet = new Set(prev);
        newSet.delete(appName);
        return newSet;
      });
    }
  };

  const handleDisconnect = async (appName: string) => {
    if (processingApps.has(appName)) return;

    const connectionId = connectionIds.get(appName);
    if (!connectionId) {
      console.error(`No connection ID found for ${appName}`);
      return;
    }

    setProcessingApps((prev) => new Set(prev.add(appName)));

    try {
      // Use the Composio API to delete the connection
      const response = await fetch(
        `https://backend.composio.dev/api/v1/connectedAccounts/${connectionId}`,
        {
          method: "DELETE",
          headers: {
            "x-api-key": process.env.REACT_APP_COMPOSIO_API_KEY!,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        // Update local state to reflect disconnection
        setConnectionStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(appName, "INACTIVE");
          return newMap;
        });

        setConnectionIds((prev) => {
          const newMap = new Map(prev);
          newMap.delete(appName);
          return newMap;
        });

        // Collapse the app if it was expanded and clear its tools
        setExpandedApps((prev) => {
          const newSet = new Set(prev);
          newSet.delete(appName);
          return newSet;
        });

        setToolsByApp((prev) => {
          const newMap = new Map(prev);
          newMap.delete(appName);
          return newMap;
        });

        setSelectedTools((prev) => {
          const newMap = new Map(prev);
          newMap.delete(appName);
          return newMap;
        });

        // Clear activation status when disconnecting
        setActivationStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.delete(appName);
          return newMap;
        });

        console.log(`✅ Successfully disconnected ${appName}`);
      } else {
        const errorData = await response.text();
        console.error(`❌ Failed to disconnect ${appName}:`, errorData);
      }
    } catch (error) {
      console.error(`❌ Error disconnecting ${appName}:`, error);
    } finally {
      setProcessingApps((prev) => {
        const newSet = new Set(prev);
        newSet.delete(appName);
        return newSet;
      });
    }
  };

  if (loading) return <div className="composio-app-list">Loading apps...</div>;

  return (
    <div className="composio-app-list">
      <div className="filter-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search apps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-container">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-container">
          <select
            value={connectionFilter}
            onChange={(e) =>
              setConnectionFilter(
                e.target.value as "all" | "connected" | "not-connected"
              )
            }
            className="connection-filter"
          >
            <option value="all">All Apps</option>
            <option value="connected">Connected Only</option>
            <option value="not-connected">Not Connected</option>
          </select>
        </div>
      </div>

      <div className="results-info">
        Showing {filteredApps.length} of {apps.length} apps
      </div>

      <div className="apps-container">
        {filteredApps.map((app) => {
          const connectionStatus = connectionStatuses.get(app.name);
          const isConnected = connectionStatus === "ACTIVE";
          const isProcessing = processingApps.has(app.name);
          const isExpanded = expandedApps.has(app.name);
          const isLoadingTools = loadingTools.has(app.name);
          const appTools = toolsByApp.get(app.name) || [];
          const selectedAppTools = selectedTools.get(app.name) || new Set();

          // New activation logic
          const isActivated = activationStatuses.get(app.name) !== false; // default is true
          const showToggleAsOn = isConnected ? isActivated : false;
          const showToolsSection = isConnected && isActivated && isExpanded;

          return (
            <div key={app.name} className="app-item-container">
              <div className={`app-item ${isConnected ? "connected" : ""}`}>
                <span className="app-entry">
                  {app.logo && (
                    <img src={app.logo} alt={app.name} className="app-logo" />
                  )}
                  <span className="pipe">|</span>
                  <span className="app-name">{app.name}</span>
                  <span className="pipe">|</span>
                  <span className="app-categories">{app.categories}</span>
                  <span className="pipe">|</span>
                  {isConnected && (
                    <span className="tools-header">
                      <span className="selected-count">
                        • {selectedAppTools.size} selected tools
                      </span>
                    </span>
                  )}
                </span>

                <div className="connection-controls">
                  {isConnected && isActivated && (
                    <button
                      className={`expand-arrow ${isExpanded ? "expanded" : ""}`}
                      onClick={() => toggleAppExpansion(app.name)}
                      title={
                        isExpanded ? "Collapse tools" : "Show available tools"
                      }
                    >
                      ▼
                    </button>
                  )}

                  <div className="connection-toggle">
                    {isConnected ? (
                      <>
                        <button
                          className="disconnect-btn"
                          onClick={() => handleDisconnect(app.name)}
                          disabled={isProcessing}
                          title="Disconnect app"
                        >
                          {isProcessing ? "⏳" : "🗑️"}
                        </button>
                        <div
                          className={`toggle-switch connected ${
                            showToggleAsOn ? "activated" : "deactivated"
                          }`}
                          onClick={() =>
                            !isProcessing && toggleAppActivation(app.name)
                          }
                          title={isActivated ? "Disable tools" : "Enable tools"}
                        >
                          <div className="toggle-slider"></div>
                        </div>
                      </>
                    ) : (
                      <div
                        className={`toggle-switch ${
                          isProcessing ? "processing" : ""
                        }`}
                        onClick={() => !isProcessing && handleConnect(app.name)}
                        title="Connect app"
                      >
                        <div className="toggle-slider"></div>
                        {isProcessing && (
                          <span className="processing-text">Connecting...</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Tools Section */}
              {showToolsSection && (
                <div className="tools-section">
                  {isLoadingTools ? (
                    <div className="tools-loading">
                      <span>⏳ Loading available tools...</span>
                    </div>
                  ) : appTools.length > 0 ? (
                    <div className="tools-list">
                      <div className="tools-header">
                        Available Tools ({appTools.length})
                        {/* {selectedAppTools.size > 0 && (
                          <span className="selected-count">
                            • {selectedAppTools.size} selected
                          </span>
                        )} */}
                      </div>
                      {appTools.map((tool) => (
                        <div key={tool.name} className="tool-item">
                          <label className="tool-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedAppTools.has(tool.name)}
                              onChange={() =>
                                toggleToolSelection(app.name, tool.name)
                              }
                            />
                            <span className="tool-info">
                              <span className="tool-name">{tool.name}</span>
                              {tool.description && (
                                <span className="tool-description">
                                  {tool.description}
                                </span>
                              )}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-tools">
                      No tools available for this app.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredApps.length === 0 && (
        <div className="no-results">No apps found matching your criteria.</div>
      )}
    </div>
  );
}
