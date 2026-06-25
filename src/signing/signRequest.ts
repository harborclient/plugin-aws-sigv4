import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { PluginHttpRequest } from "@harborclient/sdk";
import type { SignResult, SigningConfig } from "../types";
import { inferRegionFromHostname, inferServiceFromHostname } from "./parseUrl";

/**
 * Builds a Smithy HTTP request from the HarborClient plugin request shape.
 *
 * @param request - Outgoing request snapshot from the host.
 */
export function pluginRequestToHttpRequest(
  request: PluginHttpRequest
): HttpRequest {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    headers[key.toLowerCase()] = value;
  }

  const port = url.port ? Number(url.port) : undefined;

  return new HttpRequest({
    method: request.method.toUpperCase(),
    protocol: url.protocol,
    hostname: url.hostname,
    ...(port != null && !Number.isNaN(port) ? { port } : {}),
    path: `${url.pathname}${url.search}`,
    headers,
    body: request.body ?? undefined,
  });
}

/**
 * Validates signing configuration before calling AWS SigV4.
 *
 * @param config - Resolved signing inputs.
 */
export function validateSigningConfig(config: SigningConfig): string[] {
  const errors: string[] = [];
  if (!config.accessKeyId.trim()) {
    errors.push("Access Key ID is required.");
  }
  if (!config.secretAccessKey.trim()) {
    errors.push("Secret Access Key is required.");
  }
  if (!config.region.trim()) {
    errors.push("Region is required.");
  }
  if (!config.service.trim()) {
    errors.push("Service is required.");
  }
  return errors;
}

/**
 * Resolves region and service using explicit config with URL heuristics as fallback.
 *
 * @param request - Outgoing request snapshot.
 * @param config - Signing configuration with optional overrides.
 */
export function resolveRegionAndService(
  request: PluginHttpRequest,
  config: SigningConfig
): { region: string; service: string } {
  const url = new URL(request.url);
  const region =
    config.region.trim() ||
    inferRegionFromHostname(url.hostname) ||
    "us-east-1";
  const service =
    config.service.trim() || inferServiceFromHostname(url.hostname);

  return { region, service };
}

/**
 * Signs an outgoing HTTP request with AWS Signature Version 4.
 *
 * @param request - Outgoing request snapshot from the host.
 * @param config - IAM credentials and signing metadata.
 */
export async function signRequest(
  request: PluginHttpRequest,
  config: SigningConfig
): Promise<SignResult> {
  const errors = validateSigningConfig(config);
  if (errors.length > 0) {
    return { headers: {}, errors };
  }

  try {
    const { region, service } = resolveRegionAndService(request, config);
    const httpRequest = pluginRequestToHttpRequest(request);
    const signer = new SignatureV4({
      credentials: {
        accessKeyId: config.accessKeyId.trim(),
        secretAccessKey: config.secretAccessKey.trim(),
        ...(config.sessionToken?.trim()
          ? { sessionToken: config.sessionToken.trim() }
          : {}),
      },
      region,
      service,
      sha256: Sha256,
    });

    const signed = await signer.sign(httpRequest);
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(signed.headers ?? {})) {
      if (value != null) {
        headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
      }
    }

    return { headers };
  } catch (error) {
    return {
      headers: {},
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Merges signed headers into a mutable plugin request, replacing prior AWS auth headers.
 *
 * @param request - Outgoing request to mutate in place.
 * @param signedHeaders - Headers returned from {@link signRequest}.
 */
export function applySignedHeaders(
  request: PluginHttpRequest,
  signedHeaders: Record<string, string>
): void {
  for (const key of Object.keys(request.headers)) {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower.startsWith("x-amz-")) {
      delete request.headers[key];
    }
  }

  for (const [key, value] of Object.entries(signedHeaders)) {
    request.headers[key] = value;
  }
}
