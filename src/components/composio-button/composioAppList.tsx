//composioAppList.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { Composio, ComposioToolSet } from "composio-core";
import "./composio-button.scss";
import { connectToApp } from "./connectToApp";
import { useSelectedToolsContext } from "../../contexts/SelectedToolsContext";

type App = {
  name: string;
  logo: string;
  categories: string;
};

type ConnectionStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";

type ComposioTool = {
  name: string;
  description: string;
  appName: string;
  tags: string[];
};

export const COMPOSIO_ENTITY_ID =
  process.env.REACT_APP_COMPOSIO_API_KEY ?? "default";

export function ComposioAppList() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [connectionFilter, setConnectionFilter] = useState<
    "all" | "connected" | "not-connected"
  >("all");
  const [connectionStatuses, setConnectionStatuses] = useState<
    Map<string, ConnectionStatus>
  >(new Map());
  const [connectionIds, setConnectionIds] = useState<Map<string, string>>(
    new Map()
  );
  const [processingApps, setProcessingApps] = useState<Set<string>>(new Set());

  // New state for collapsible tool sections
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [toolsByApp, setToolsByApp] = useState<Map<string, ComposioTool[]>>(
    new Map()
  );
  const [loadingTools, setLoadingTools] = useState<Set<string>>(new Set());

  // Use global context for selected tools and activation statuses
  const {
    selectedTools,
    setSelectedTools,
    setToolDescriptions,
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

  // Get unique categories from apps
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    apps.forEach((app) => {
      if (app.categories && app.categories !== "Uncategorized") {
        app.categories
          .split(", ")
          .forEach((cat) => uniqueCategories.add(cat.trim()));
      }
    });
    return Array.from(uniqueCategories).sort();
  }, [apps]);

  // Check connection status for all apps using entity.getConnection
  const fetchAllConnectionStatuses = useCallback(
    async (apps: App[]) => {
      const statusMap = new Map<string, ConnectionStatus>();
      const idMap = new Map<string, string>();

      let entity;
      try {
        entity = await toolset.getEntity(COMPOSIO_ENTITY_ID);
      } catch (err) {
        console.error("❌ Failed to get Composio entity:", err);
        apps.forEach((app) => statusMap.set(app.name, "UNKNOWN"));
        setConnectionStatuses(statusMap);
        return;
      }

      try {
        const allConnections = await entity.getConnections();

        // Build a lookup table for connected apps
        const connectedAppMap = new Map<string, string>(); // appName -> connectionId

        for (const conn of allConnections) {
          if (conn.status === "ACTIVE" && conn.appName && conn.id) {
            connectedAppMap.set(conn.appName.toLowerCase(), conn.id);
          }
        }

        // Match apps with connections
        apps.forEach((app) => {
          const appKey = app.name.toLowerCase();
          if (connectedAppMap.has(appKey)) {
            statusMap.set(app.name, "ACTIVE");
            idMap.set(app.name, connectedAppMap.get(appKey)!);
          } else {
            statusMap.set(app.name, "INACTIVE");
          }
        });
      } catch (err) {
        console.error("❌ Error fetching connections:", err);
        apps.forEach((app) => statusMap.set(app.name, "UNKNOWN"));
      }

      setConnectionStatuses(statusMap);
      setConnectionIds(idMap);
    },
    [toolset]
  );

  // Fetch tools for a specific app
  const fetchToolsForApp = useCallback(
    async (appName: string) => {
      if (toolsByApp.has(appName) || loadingTools.has(appName)) {
        return;
      }

      setLoadingTools((prev) => new Set(prev.add(appName)));

      try {
        const actions = await toolset.actions.list({
          apps: appName.toLowerCase(),
        });

        const tools: ComposioTool[] = (actions.items || []).map(
          (action: any) => ({
            name: action.name || "Unknown Action",
            description: action.description || "No description available",
            appName: appName,
            tags: action.tags || [],
          })
        );

        setToolsByApp((prev) => new Map(prev.set(appName, tools)));

        // Store tool descriptions in global context
        setToolDescriptions((prev) => {
          const newMap = new Map(prev);
          tools.forEach((tool) => {
            newMap.set(tool.name, {
              name: tool.name,
              description: tool.description,
              appName: tool.appName,
            });
          });
          return newMap;
        });

        console.log(`✅ Fetched ${tools.length} tools for ${appName}`);
      } catch (error) {
        console.error(`❌ Failed to fetch tools for ${appName}:`, error);
        setToolsByApp((prev) => new Map(prev.set(appName, [])));
      } finally {
        setLoadingTools((prev) => {
          const newSet = new Set(prev);
          newSet.delete(appName);
          return newSet;
        });
      }
    },
    [toolset, toolsByApp, loadingTools, setToolDescriptions]
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

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const composio = new Composio({
          apiKey: process.env.REACT_APP_COMPOSIO_API_KEY!,
        });

        const raw = await composio.apps.list();

        const result = JSON.parse(JSON.stringify(raw));
        console.log("[Composio Button] Cleaned App Result:", result);

        const simplifiedApps: App[] = result
          .filter((app: any) => app.auth_schemes?.[0]?.mode === "OAUTH2")
          .map((app: any) => ({
            name: app.displayName ?? "Unknown",
            logo: app.logo ?? "",
            categories: Array.isArray(app.categories)
              ? app.categories.join(", ")
              : (app.categories ?? "Uncategorized"),
          }));

        const sortedApps = simplifiedApps.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setApps(sortedApps);

        if (sortedApps.length) await fetchAllConnectionStatuses(sortedApps);
        console.log("[Composio Button] Apps set in state:", sortedApps);
      } catch (error) {
        console.error("❌ Error fetching Composio apps:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [fetchAllConnectionStatuses]);

  // Filter apps based on search, category, and connection status
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch = app.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" ||
        app.categories.toLowerCase().includes(selectedCategory.toLowerCase());

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
