import { resolveRequest } from "@harborclient/sdk/http";
import type { PluginContext, RequestTabContext } from "@harborclient/sdk";
import type {
  CollectionAwsConfig,
  RequestAwsSettings,
  SignResult,
  SigningConfig,
} from "../types";
import { collectionStorageKey, draftStorageKey } from "../storage/keys";
import {
  parseCollectionAwsConfig,
  parseRequestAwsSettings,
} from "../storage/defaults";
import { loadConfigIndex } from "../sync/configSync";

/**
 * Builds signing configuration from collection credentials and request overrides.
 *
 * @param collection - Collection-level AWS credentials.
 * @param requestSettings - Per-request overrides.
 */
export function buildSigningConfigFromProfiles(
  collection: CollectionAwsConfig,
  requestSettings: RequestAwsSettings
): SigningConfig | null {
  if (requestSettings.collectionId == null) {
    return null;
  }
  if (!collection.accessKeyId.trim() || !collection.secretAccessKey.trim()) {
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
 * Converts a resolved request snapshot into the plugin HTTP request shape for signing.
 *
 * @param resolved - Fully merged request from {@link resolveRequest}.
 */
export function resolvedToPluginHttpRequest(resolved: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}) {
  return {
    method: resolved.method,
    url: resolved.url,
    headers: { ...resolved.headers },
    body: resolved.body,
  };
}

/**
 * Loads collection profiles referenced by the config index for request tab pickers.
 *
 * @param hc - Renderer plugin context.
 */
export async function loadConfiguredCollections(
  hc: PluginContext
): Promise<Array<{ id: number; config: CollectionAwsConfig }>> {
  const index = await loadConfigIndex(hc);
  const entries: Array<{ id: number; config: CollectionAwsConfig }> = [];
  for (const collectionId of index.collections) {
    const stored = await hc.storage.get(collectionStorageKey(collectionId));
    const config = parseCollectionAwsConfig(stored);
    if (config.accessKeyId.trim() && config.secretAccessKey.trim()) {
      entries.push({ id: collectionId, config });
    }
  }
  return entries.sort((left, right) => left.id - right.id);
}

/**
 * Signs the active request editor tab for preview using the main-process signer.
 *
 * @param hc - Renderer plugin context.
 * @param context - Read-only request tab context.
 * @param requestSettings - Per-request overrides for the active request.
 */
export async function previewSignActiveRequest(
  hc: PluginContext,
  context: RequestTabContext,
  requestSettings: RequestAwsSettings
): Promise<SignResult> {
  if (requestSettings.collectionId == null) {
    return {
      headers: {},
      errors: ["Select a credential profile collection before signing."],
    };
  }

  const stored = await hc.storage.get<CollectionAwsConfig>(
    collectionStorageKey(requestSettings.collectionId)
  );
  const collection = parseCollectionAwsConfig(stored);
  const signingConfig = buildSigningConfigFromProfiles(
    collection,
    requestSettings
  );
  if (!signingConfig) {
    return {
      headers: {},
      errors: [
        "Configure AWS credentials in Collection Settings before signing.",
      ],
    };
  }

  const resolved = resolveRequest(context);
  const request = resolvedToPluginHttpRequest(resolved);

  return hc.ipc.invoke<SignResult>("sign", {
    request,
    config: signingConfig,
  });
}

/**
 * Loads persisted per-request settings for the active draft fingerprint.
 *
 * @param hc - Renderer plugin context.
 * @param context - Read-only request tab context.
 */
export async function loadRequestSettingsForContext(
  hc: PluginContext,
  context: RequestTabContext
): Promise<{ key: string; settings: RequestAwsSettings }> {
  const key = draftStorageKey(context.draft);
  const stored = await hc.storage.get<RequestAwsSettings>(key);
  return {
    key,
    settings: parseRequestAwsSettings(stored),
  };
}
