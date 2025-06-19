import { ComposioToolSet } from "composio-core";
import { toast } from "react-tiny-toast";

const toolset = new ComposioToolSet({
  apiKey: process.env.REACT_APP_COMPOSIO_API_KEY!,
});

export async function connectToApp(
  appName: string,
  userId: string = "default"
): Promise<boolean> {
  try {
    const entity = await toolset.getEntity(userId);

    // Check if already connected
    try {
      const connection = await entity.getConnection({ app: appName });
      if (connection?.status === "ACTIVE") {
        toast.show(`✅ Already connected to ${appName}.`, { timeout: 3000 });
        return true;
      }
    } catch {
      // Not connected yet — continue to initiate connection
    }

    // Start OAuth connection
    const connectionRequest = await toolset.connectedAccounts.initiate({
      appName,
      authMode: "OAUTH2",
      entityId: userId,
    });

    if (!connectionRequest.redirectUrl) {
      toast.show(`❌ No redirect URL received for ${appName}`, {
        timeout: 4000,
      });
      return false;
    }

    toast.show(`🔄 Redirecting to ${appName} authentication...`, {
      timeout: 2000,
    });

    // Open as regular tab (not a popup)
    const windowRef = window.open(connectionRequest.redirectUrl, "_blank");

    if (!windowRef) {
      toast.show(`❌ Popup blocked. Please allow popups for this site.`, {
        timeout: 4000,
      });
      return false;
    }

    // Race between success, tab close, and timeout
    const waitForTabCloseOrTimeout = new Promise<boolean>((resolve) => {
      const checkInterval = setInterval(() => {
        if (windowRef.closed) {
          clearInterval(checkInterval);
          console.log(`❌ User closed OAuth tab for ${appName}`);
          resolve(false);
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (!windowRef.closed) windowRef.close();
        console.log(`⏰ OAuth timeout for ${appName}`);
        resolve(false);
      }, 180_000); // 3 minutes
    });

    const result = await Promise.race([
      connectionRequest
        .waitUntilActive(180)
        .then((conn) => conn?.status === "ACTIVE"),
      waitForTabCloseOrTimeout,
    ]);

    if (!windowRef.closed) windowRef.close();

    toast.show(
      result
        ? `✅ Connected to ${appName}`
        : `❌ Connection cancelled or failed`,
      { timeout: 3000 }
    );

    return result;
  } catch (err) {
    console.error("Composio connect error:", err);
    toast.show(`❌ Failed to connect to ${appName}`, { timeout: 4000 });
    return false;
  }
}
