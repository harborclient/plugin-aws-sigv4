import type { PluginHttpRequest } from "@harborclient/sdk";

/**
 * AWS credentials and defaults stored per collection.
 */
export interface CollectionAwsConfig {
  /**
   * IAM access key id.
   */
  accessKeyId: string;

  /**
   * IAM secret access key.
   */
  secretAccessKey: string;

  /**
   * AWS region (for example `us-east-1`).
   */
  region: string;

  /**
   * AWS service signing name (for example `execute-api`, `s3`).
   */
  service: string;

  /**
   * Optional STS session token.
   */
  sessionToken?: string;

  /**
   * When true, requests with matching per-request settings are signed before send.
   */
  autoSign: boolean;
}

/**
 * Per-request AWS signing overrides and credential profile selection.
 */
export interface RequestAwsSettings {
  /**
   * Collection whose {@link CollectionAwsConfig} credentials to use.
   */
  collectionId: number | null;

  /**
   * Optional region override for this request.
   */
  region?: string;

  /**
   * Optional service override for this request.
   */
  service?: string;

  /**
   * Optional session token override for this request.
   */
  sessionToken?: string;

  /**
   * When true, sign this request automatically before send.
   */
  autoSign: boolean;
}

/**
 * Fully resolved signing inputs for {@link signRequest}.
 */
export interface SigningConfig {
  /**
   * IAM access key id.
   */
  accessKeyId: string;

  /**
   * IAM secret access key.
   */
  secretAccessKey: string;

  /**
   * AWS region used for signing.
   */
  region: string;

  /**
   * AWS service signing name.
   */
  service: string;

  /**
   * Optional STS session token.
   */
  sessionToken?: string;
}

/**
 * Result returned by the signing IPC channel and preview UI.
 */
export interface SignResult {
  /**
   * Signed headers to merge into the outgoing request.
   */
  headers: Record<string, string>;

  /**
   * Validation or signing errors, if any.
   */
  errors?: string[];
}

/**
 * Snapshot pushed from renderer to main for send-time signing.
 */
export interface ConfigSnapshot {
  /**
   * Collection AWS configs keyed by collection database id.
   */
  collections: Record<number, CollectionAwsConfig>;

  /**
   * Per-request settings keyed by saved request id string (`request:123`).
   */
  requests: Record<string, RequestAwsSettings>;

  /**
   * Per-draft settings keyed by method/url fingerprint (`draft:GET:https://...`).
   */
  drafts: Record<string, RequestAwsSettings>;
}

/**
 * Index of storage keys maintained by the renderer for bulk sync on activate.
 */
export interface ConfigIndex {
  /**
   * Collection ids that have saved AWS configuration.
   */
  collections: number[];

  /**
   * Request override storage keys.
   */
  requestKeys: string[];
}

/**
 * Payload accepted by the main-process sign IPC handler.
 */
export interface SignPayload {
  /**
   * Outgoing HTTP request to sign.
   */
  request: PluginHttpRequest;

  /**
   * Resolved signing credentials and service metadata.
   */
  config: SigningConfig;
}
