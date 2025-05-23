import { ComposioToolSet } from "composio-core";
import { toast } from "react-tiny-toast";

const toolset = new ComposioToolSet({
  apiKey: process.env.REACT_APP_COMPOSIO_API_KEY!,
});

export async function connectToApp(
  appName: string,
  userId: string = "default"
) {
  try {
    const entity = await toolset.getEntity(userId);

    try {
      const connection = await entity.getConnection({ app: appName });
      if (connection?.status === "ACTIVE") {
        toast.show(`✅ Already connected to ${appName}.`, { timeout: 3000 });
        return;
      }
    } catch {}

    const connectionRequest = await entity.initiateConnection({
      appName,
      authMode: "OAUTH2",
    });

    if (connectionRequest.redirectUrl) {
      toast.show(`🔄 Redirecting to ${appName} authentication...`, {
        timeout: 2000,
      });
      window.open(connectionRequest.redirectUrl, "_blank");
    } else {
      toast.show(`❌ No redirect URL received for ${appName}`, {
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error("Composio connect error:", err);
    toast.show(`❌ Failed to connect to ${appName}`, { timeout: 4000 });
  }
}
