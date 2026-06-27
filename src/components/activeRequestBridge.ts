import type { PluginContext, RequestTabContext } from '@harborclient/sdk';

/**
 * Active request editor context shared between the request tab and toolbar command.
 */
export interface ActiveRequestBridge {
  /**
   * Read-only request tab context from the host.
   */
  context: RequestTabContext;

  /**
   * Renderer plugin context for storage and IPC.
   */
  hc: PluginContext;
}

let activeBridge: ActiveRequestBridge | null = null;

/**
 * Updates the active request bridge when the AWS request tab is mounted or changes.
 *
 * @param bridge - Latest request tab context, or null when the tab unmounts.
 */
export function setActiveRequestBridge(bridge: ActiveRequestBridge | null): void {
  activeBridge = bridge;
}

/**
 * Returns the latest request tab context registered by the AWS request tab.
 */
export function getActiveRequestBridge(): ActiveRequestBridge | null {
  return activeBridge;
}
