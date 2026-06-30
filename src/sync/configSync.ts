import type {
  CollectionAwsConfig,
  ConfigIndex,
  ConfigSnapshot,
  RequestAwsSettings
} from '../types';
import type { PluginContext } from '@harborclient/sdk';
import { asRecord, numArray, strArray } from '@harborclient/sdk/storage';
import { getActiveRequestBridge } from '../components/activeRequestBridge';
import { CONFIG_INDEX_KEY, collectionStorageKey } from '../storage/keys';
import { parseCollectionAwsConfig, parseRequestAwsSettings } from '../storage/defaults';

/**
 * Returns an empty config index.
 */
export function emptyConfigIndex(): ConfigIndex {
  return { collections: [], requestKeys: [] };
}

/**
 * Parses a persisted config index from plugin storage.
 *
 * @param stored - Raw value from plugin storage.
 */
export function parseConfigIndex(stored: unknown): ConfigIndex {
  const record = asRecord(stored);
  if (!record) {
    return emptyConfigIndex();
  }

  return {
    collections: numArray(record.collections),
    requestKeys: strArray(record.requestKeys).filter((key) => key.length > 0)
  };
}

/**
 * Registers a collection id in the config index when credentials are saved.
 *
 * @param index - Existing config index.
 * @param collectionId - Collection database id.
 */
export function registerCollectionInIndex(index: ConfigIndex, collectionId: number): ConfigIndex {
  if (index.collections.includes(collectionId)) {
    return index;
  }
  return {
    ...index,
    collections: [...index.collections, collectionId].sort((a, b) => a - b)
  };
}

/**
 * Registers a request override storage key in the config index.
 *
 * @param index - Existing config index.
 * @param requestKey - Request or draft storage key.
 */
export function registerRequestKeyInIndex(index: ConfigIndex, requestKey: string): ConfigIndex {
  if (index.requestKeys.includes(requestKey)) {
    return index;
  }
  return {
    ...index,
    requestKeys: [...index.requestKeys, requestKey]
  };
}

/**
 * Loads the config index from plugin storage.
 *
 * @param hc - Renderer plugin context.
 */
export async function loadConfigIndex(hc: PluginContext): Promise<ConfigIndex> {
  const stored = await hc.storage.get<ConfigIndex>(CONFIG_INDEX_KEY);
  return parseConfigIndex(stored);
}

/**
 * Persists the config index and pushes a snapshot to the main runtime.
 *
 * @param hc - Renderer plugin context.
 * @param index - Updated config index.
 */
export async function saveConfigIndex(hc: PluginContext, index: ConfigIndex): Promise<void> {
  await hc.storage.set(CONFIG_INDEX_KEY, index);
  await syncConfigToMain(hc, index);
}

/**
 * Builds a config snapshot from storage using the persisted index.
 *
 * @param hc - Renderer plugin context.
 * @param index - Config index listing known storage keys.
 */
export async function buildConfigSnapshot(
  hc: PluginContext,
  index: ConfigIndex
): Promise<ConfigSnapshot> {
  const collections: Record<number, CollectionAwsConfig> = {};
  for (const collectionId of index.collections) {
    const stored = await hc.storage.get(collectionStorageKey(collectionId));
    collections[collectionId] = parseCollectionAwsConfig(stored);
  }

  const requests: Record<string, RequestAwsSettings> = {};
  const drafts: Record<string, RequestAwsSettings> = {};
  for (const key of index.requestKeys) {
    const stored = await hc.storage.get<RequestAwsSettings>(key);
    const settings = parseRequestAwsSettings(stored);
    if (key.startsWith('draft:')) {
      drafts[key] = settings;
    } else {
      requests[key] = settings;
    }
  }

  return { collections, requests, drafts };
}

/**
 * Returns runtime variables from the active AWS request tab bridge, if any.
 */
function activeRuntimeVariables(): Record<string, string> | undefined {
  return getActiveRequestBridge()?.context.variables;
}

/**
 * Pushes the latest signing configuration snapshot to the main plugin runtime.
 *
 * @param hc - Renderer plugin context.
 * @param index - Optional preloaded config index.
 */
export async function syncConfigToMain(hc: PluginContext, index?: ConfigIndex): Promise<void> {
  const resolvedIndex = index ?? (await loadConfigIndex(hc));
  const snapshot = await buildConfigSnapshot(hc, resolvedIndex);
  const runtimeVariables = activeRuntimeVariables();
  await hc.ipc.invoke('syncConfig', {
    ...snapshot,
    ...(runtimeVariables != null ? { runtimeVariables } : {})
  });
}

/**
 * Saves collection AWS settings, updates the index, and syncs to main.
 *
 * @param hc - Renderer plugin context.
 * @param collectionId - Collection database id.
 * @param config - Collection credential profile.
 */
export async function saveCollectionAwsConfig(
  hc: PluginContext,
  collectionId: number,
  config: CollectionAwsConfig
): Promise<void> {
  await hc.storage.set(collectionStorageKey(collectionId), config);
  const index = registerCollectionInIndex(await loadConfigIndex(hc), collectionId);
  await saveConfigIndex(hc, index);
}

/**
 * Saves per-request AWS settings, updates the index, and syncs to main.
 *
 * @param hc - Renderer plugin context.
 * @param requestKey - Request or draft storage key.
 * @param settings - Per-request signing overrides.
 */
export async function saveRequestAwsSettings(
  hc: PluginContext,
  requestKey: string,
  settings: RequestAwsSettings
): Promise<void> {
  await hc.storage.set(requestKey, settings);
  const index = registerRequestKeyInIndex(await loadConfigIndex(hc), requestKey);
  await saveConfigIndex(hc, index);
}
