import { asRecord, bool, num, str } from '@harborclient/sdk/storage';
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
  const record = asRecord(stored);
  if (!record) {
    return defaultCollectionAwsConfig();
  }

  return {
    accessKeyId: str(record.accessKeyId, ''),
    secretAccessKey: str(record.secretAccessKey, ''),
    region: str(record.region, 'us-east-1'),
    service: str(record.service, ''),
    sessionToken: str(record.sessionToken, ''),
    autoSign: bool(record.autoSign, true)
  };
}

/**
 * Parses persisted per-request AWS settings from plugin storage JSON.
 *
 * @param stored - Raw value from plugin storage.
 */
export function parseRequestAwsSettings(stored: unknown): RequestAwsSettings {
  const record = asRecord(stored);
  if (!record) {
    return defaultRequestAwsSettings();
  }

  return {
    collectionId: num(record.collectionId, null),
    region: str(record.region, ''),
    service: str(record.service, ''),
    sessionToken: str(record.sessionToken, ''),
    autoSign: bool(record.autoSign, true)
  };
}
