import { useDependencies, useSelectedToolsContext } from "@context";
import { Application, Tool } from "@core/domain";
import { ComposioToolSet } from "composio-core";
import { useCallback, useEffect, useMemo, useState } from "react";

type ConnectionStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN";

export const useAppListViewModels = (userId: string) => {
  const { getAvailableApps, getApplicationTools } = useDependencies();
  const [loadingTools, setLoadingTools] = useState<Set<string>>(new Set());
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatuses, setConnectionStatuses] = useState<
    Map<string, ConnectionStatus>
  >(new Map());
  const [toolsByApp, setToolsByApp] = useState<Map<string, Tool[]>>(new Map());
  const [connectionIds, setConnectionIds] = useState<Map<string, string>>(
    new Map()
  );
  const [processingApps, setProcessingApps] = useState<Set<string>>(new Set());

  // Use global context for selected tools and activation statuses
  const { setToolDescriptions } = useSelectedToolsContext();

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
    Array.from(
      apps
        .map((app) => app.categories)
        .flat()
        .filter((category) => category !== "Uncategorized")
    ).forEach((cat) => uniqueCategories.add(cat));
    return Array.from(uniqueCategories).sort();
  }, [apps]);

  // Check connection status for all apps using entity.getConnection
  const fetchAllConnectionStatuses = useCallback(
    async (apps: Application[]) => {
      const statusMap = new Map<string, ConnectionStatus>();
      const idMap = new Map<string, string>();

      let entity;
      try {
        entity = await toolset.getEntity(userId);
      } catch (err) {
        console.error("❌ Failed to get Composio entity:", err);
        apps.forEach((app) => statusMap.set(app.name, "UNKNOWN"));
        setConnectionStatuses(statusMap);
        return;
      }

      try {
        const allConnections = await entity.getConnections();
        console.log("[Composio Button] All connections:", allConnections);

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
    [toolset, userId]
  );

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const result = await getAvailableApps.execute({});

        // const result = JSON.parse(JSON.stringify(raw));
        console.log("[Composio Button] Cleaned App Result:", result);

        const sortedApps = [...result].sort((a, b) =>
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
  }, [getAvailableApps, fetchAllConnectionStatuses]);

  // Fetch tools for a specific app
  const fetchToolsForApp = useCallback(
    async (appName: string) => {
      if (toolsByApp.has(appName) || loadingTools.has(appName)) {
        return;
      }

      setLoadingTools((prev) => new Set(prev.add(appName)));

      try {
        const tools = await getApplicationTools.execute({ appName });
        console.log("[Composio Tools] The tools for the app are:", tools);

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
    [toolsByApp, loadingTools, setToolDescriptions, getApplicationTools]
  );

  return {
    categories,
    loadingTools,
    fetchToolsForApp,
    apps,
    loading,
    connectionStatuses,
    setConnectionStatuses,
    toolsByApp,
    setToolsByApp,
    connectionIds,
    setConnectionIds,
    processingApps,
    setProcessingApps,
  };
};
