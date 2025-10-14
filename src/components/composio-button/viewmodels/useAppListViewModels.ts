import { useDependencies, useSelectedToolsContext } from "@context";
import { Application, Tool } from "@core/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

type ConnectionStatus = "ACTIVE" | "INACTIVE" | "INITIATED" | "EXPIRED";

export const useAppListViewModels = (userId: string) => {
  const { getAvailableApps, getApplicationTools, checkConnectionStatus } =
    useDependencies();

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

  const { setToolDescriptions } = useSelectedToolsContext();

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

  const fetchAllConnectionStatuses = useCallback(async () => {
    try {
      const results = await checkConnectionStatus.execute({});
      const statusMap = new Map<string, ConnectionStatus>();
      const idMap = new Map<string, string>();

      results.forEach((conn) => {
        const status = conn.status.toUpperCase() as ConnectionStatus;
        statusMap.set(conn.appName, status);

        // Optional: if `conn` has an ID field in future, include it here
        // idMap.set(conn.appName, conn.id ?? "");
      });

      setConnectionStatuses(statusMap);
      setConnectionIds(idMap);
    } catch (err) {
      console.error("❌ Failed to check connection statuses:", err);
    }
  }, [checkConnectionStatus]);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const result = await getAvailableApps.execute({});
        const sortedApps = [...result].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setApps(sortedApps);

        if (sortedApps.length) await fetchAllConnectionStatuses();
      } catch (error) {
        console.error("❌ Error fetching apps:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [getAvailableApps, fetchAllConnectionStatuses]);

  const fetchToolsForApp = useCallback(
    async (appName: string) => {
      if (toolsByApp.has(appName) || loadingTools.has(appName)) return;

      setLoadingTools((prev) => new Set(prev.add(appName)));

      try {
        const tools = await getApplicationTools.execute({ appName });
        setToolsByApp((prev) => new Map(prev.set(appName, tools)));

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
