import type {
  ConfigSnapshot,
  RequestAwsSettings,
  SignPayload,
  SigningConfig,
} from "./types";
import type { PluginHttpRequest } from "@harborclient/sdk";
import { applySignedHeaders, signRequest } from "./signing/signRequest";
import { resolveRequestStorageKey, requestStorageKey } from "./storage/keys";

/**
 * In-memory config snapshot synced from the renderer half of the plugin.
 */
let configSnapshot: ConfigSnapshot = {
  collections: {},
  requests: {},
  drafts: {},
};

/**
 * Replaces the cached signing configuration snapshot.
 *
 * @param snapshot - Renderer-provided collection and request settings.
 */
export function setConfigSnapshot(snapshot: ConfigSnapshot): void {
  configSnapshot = {
    collections: { ...snapshot.collections },
    requests: { ...snapshot.requests },
    drafts: { ...snapshot.drafts },
  };
}

/**
 * Returns the active configuration snapshot.
 */
export function getConfigSnapshot(): ConfigSnapshot {
  return configSnapshot;
}

/**
 * Parses a numeric collection id from unknown IPC input.
 *
 * @param value - Raw collection id from storage keys or settings.
 */
function parseCollectionId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

/**
 * Resolves per-request settings for an outgoing HTTP request.
 *
 * @param request - Outgoing request snapshot from the host.
 */
export function resolveRequestSettings(
  request: PluginHttpRequest
): RequestAwsSettings | undefined {
  if (request.sourceRequestId != null) {
    const byId =
      configSnapshot.requests[requestStorageKey(request.sourceRequestId)];
    if (byId) {
      return byId;
    }
  }

  const draftKey = resolveRequestStorageKey(request);
  return configSnapshot.drafts[draftKey] ?? configSnapshot.requests[draftKey];
}

/**
 * Builds the effective signing configuration for one request.
 *
 * @param request - Outgoing request snapshot.
 * @param requestSettings - Per-request overrides when available.
 */
export function buildSigningConfig(
  request: PluginHttpRequest,
  requestSettings: RequestAwsSettings
): SigningConfig | null {
  const collectionId = parseCollectionId(requestSettings.collectionId);
  if (collectionId == null) {
    return null;
  }

  const collection = configSnapshot.collections[collectionId];
  if (!collection) {
    return null;
  }

  return {
    accessKeyId: collection.accessKeyId,
    secretAccessKey: collection.secretAccessKey,
    region: requestSettings.region?.trim() || collection.region,
    service: requestSettings.service?.trim() || collection.service,
    sessionToken:
      requestSettings.sessionToken?.trim() || collection.sessionToken?.trim(),
  };
}

/**
 * Signs a request using an explicit payload from the renderer IPC channel.
 *
 * @param payload - Request snapshot and signing configuration.
 */
export async function signWithPayload(payload: SignPayload) {
  return signRequest(payload.request, payload.config);
}

/**
 * Attempts automatic SigV4 signing for an outgoing request when configured.
 *
 * @param request - Mutable outgoing request from the host send pipeline.
 */
export async function applyAutoSign(request: PluginHttpRequest): Promise<void> {
  const requestSettings = resolveRequestSettings(request);
  if (!requestSettings?.autoSign) {
    return;
  }

  const signingConfig = buildSigningConfig(request, requestSettings);
  if (!signingConfig) {
    return;
  }

  const collectionId = parseCollectionId(requestSettings.collectionId);
  const collection =
    collectionId != null ? configSnapshot.collections[collectionId] : undefined;
  if (!collection?.autoSign) {
    return;
  }

  const result = await signRequest(request, signingConfig);
  if (result.errors?.length || Object.keys(result.headers).length === 0) {
    return;
  }

  applySignedHeaders(request, result.headers);
}
