import type { CollectionAwsConfig, RequestAwsSettings } from '../types';

/**
 * Returns default collection AWS settings for a new collection profile.
 */
export function defaultCollectionAwsConfig(): CollectionAwsConfig {
  return {
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    service: '',
    sessionToken: '',
    autoSign: true
  };
}

/**
 * Returns default per-request AWS settings.
 */
export function defaultRequestAwsSettings(): RequestAwsSettings {
  return {
    collectionId: null,
    region: '',
    service: '',
    sessionToken: '',
    autoSign: true
  };
}

/**
 * Parses persisted collection AWS settings from plugin storage JSON.
 *
 * @param stored - Raw value from plugin storage.
 */
export function parseCollectionAwsConfig(stored: unknown): CollectionAwsConfig {
  if (!stored || typeof stored !== 'object') {
    return defaultCollectionAwsConfig();
  }

  const record = stored as Partial<CollectionAwsConfig>;
  return {
    accessKeyId: typeof record.accessKeyId === 'string' ? record.accessKeyId : '',
    secretAccessKey: typeof record.secretAccessKey === 'string' ? record.secretAccessKey : '',
    region: typeof record.region === 'string' ? record.region : 'us-east-1',
    service: typeof record.service === 'string' ? record.service : '',
    sessionToken: typeof record.sessionToken === 'string' ? record.sessionToken : '',
    autoSign: record.autoSign !== false
  };
}

/**
 * Parses persisted per-request AWS settings from plugin storage JSON.
 *
 * @param stored - Raw value from plugin storage.
 */
export function parseRequestAwsSettings(stored: unknown): RequestAwsSettings {
  if (!stored || typeof stored !== 'object') {
    return defaultRequestAwsSettings();
  }

  const record = stored as Partial<RequestAwsSettings>;
  return {
    collectionId: typeof record.collectionId === 'number' ? record.collectionId : null,
    region: typeof record.region === 'string' ? record.region : '',
    service: typeof record.service === 'string' ? record.service : '',
    sessionToken: typeof record.sessionToken === 'string' ? record.sessionToken : '',
    autoSign: record.autoSign !== false
  };
}
