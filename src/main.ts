import type {
  MainPluginContext,
  PluginHttpRequest,
} from "@harborclient/sdk/main";
import {
  applyAutoSign,
  setConfigSnapshot,
  signWithPayload,
} from "./configCache";
import type { ConfigSnapshot, SignPayload } from "./types";

/**
 * Activates the main-process half: IPC handlers and automatic request signing.
 *
 * @param hc - Main plugin context from the HarborClient host.
 */
export function activate(hc: MainPluginContext): void {
  hc.subscriptions.push(
    hc.ipc.handle("syncConfig", (snapshot: unknown) => {
      if (!snapshot || typeof snapshot !== "object") {
        return;
      }
      setConfigSnapshot(snapshot as ConfigSnapshot);
    }),
    hc.ipc.handle("sign", (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        throw new Error("Sign payload is required.");
      }
      return signWithPayload(payload as SignPayload);
    }),
    hc.http.onBeforeSend(async (request: PluginHttpRequest) => {
      await applyAutoSign(request);
    })
  );
}
