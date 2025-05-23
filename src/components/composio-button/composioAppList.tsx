//composioAppList.tsx
import { useEffect, useState } from "react";
import { Composio } from "composio-core";
import "./composio-button.scss";
import { connectToApp } from "./connectToApp";
// Define what you need to render
type App = {
  name: string;
  logo: string;
  categories: string;
};

export function ComposioAppList() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const composio = new Composio({
          apiKey: process.env.REACT_APP_COMPOSIO_API_KEY!,
        });

        const raw = await composio.apps.list();
        const integrations = await composio.integrations.list({});

        // Flatten any class instances to plain objects
        const result = JSON.parse(JSON.stringify(raw));
        console.log("[Composio Button] Cleaned App Result:", result);
        console.log("[Composio Button] Existing Integrations:", integrations);

        if (result.length && typeof result[0] === "object") {
          console.log("✅ First app keys:", Object.keys(result[0]));
        }

        const simplifiedApps: App[] = result.map((app: any) => ({
          name: app.name ?? "Unknown",
          logo: app.logo ?? "",
          categories: Array.isArray(app.categories)
            ? app.categories.join(", ")
            : app.categories ?? "Uncategorized",
        }));

        setApps(simplifiedApps.sort((a, b) => a.name.localeCompare(b.name)));
        console.log("[Composio Button] Apps set in state:", simplifiedApps);
      } catch (error) {
        console.error("❌ Error fetching Composio apps:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  if (loading) return <div className="composio-app-list">Loading apps...</div>;

  return (
    <div className="composio-app-list">
      {apps.map((app) => (
        <div
          key={app.name}
          className="app-item"
          onClick={() => connectToApp(app.name.toLowerCase())}
          style={{ cursor: "pointer" }}
        >
          <span className="app-entry">
            {app.logo && (
              <img src={app.logo} alt={app.name} className="app-logo" />
            )}
            <span className="pipe">|</span>
            <span className="app-name">{app.name}</span>
            <span className="pipe">|</span>
            <span className="app-categories">{app.categories}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
