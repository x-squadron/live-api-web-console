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

    try {
      const connection = await entity.getConnection({ app: appName });
      if (connection?.status === "ACTIVE") {
        toast.show(`✅ Already connected to ${appName}.`, { timeout: 3000 });
        return true;
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
      
      // Open popup and wait for it to close
      const popup = window.open(connectionRequest.redirectUrl, "_blank", "width=600,height=700");
      
      if (!popup) {
        toast.show(`❌ Popup blocked. Please allow popups for this site.`, {
          timeout: 4000,
        });
        return false;
      }

      // Wait for popup to close
      return new Promise((resolve) => {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            console.log(`🔄 OAuth popup closed for ${appName}`);
            resolve(true);
          }
        }, 1000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
          if (!popup.closed) {
            popup.close();
          }
          console.log(`⏰ OAuth timeout for ${appName}`);
          resolve(false);
        }, 300000);
      });
    } else {
      toast.show(`❌ No redirect URL received for ${appName}`, {
        timeout: 4000,
      });
      return false;
    }
  } catch (err) {
    console.error("Composio connect error:", err);
    toast.show(`❌ Failed to connect to ${appName}`, { timeout: 4000 });
    return false;
  }
}
