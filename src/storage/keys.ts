import type { PluginHttpRequest } from "@harborclient/sdk";
import type { RequestDraft } from "@harborclient/sdk";

/**
 * Storage key for the config index manifest.
 */
export const CONFIG_INDEX_KEY = "_aws-config-index";

/**
 * Builds the storage key for collection-level AWS credentials.
 *
 * @param collectionId - Collection database id.
 */
export function collectionStorageKey(collectionId: number): string {
  return `collection:${collectionId}`;
}

/**
 * Builds the storage key for a saved request override profile.
 *
 * @param requestId - Saved request database id.
 */
export function requestStorageKey(requestId: number): string {
  return `request:${requestId}`;
}

/**
 * Builds a stable storage key from an unsaved request draft fingerprint.
 *
 * @param draft - Active request draft from the editor.
 */
export function draftStorageKey(
  draft: Pick<RequestDraft, "method" | "url">
): string {
  return `draft:${draft.method}:${draft.url}`;
}

/**
 * Resolves the override storage key for a plugin HTTP request at send time.
 *
 * @param request - Outgoing request snapshot from the host send pipeline.
 */
export function resolveRequestStorageKey(request: PluginHttpRequest): string {
  if (request.sourceRequestId != null) {
    return requestStorageKey(request.sourceRequestId);
  }
  return `draft:${request.method}:${request.url}`;
}
