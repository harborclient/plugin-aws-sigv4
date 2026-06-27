/**
 * Derives a default AWS SigV4 service name from the request hostname.
 *
 * @param hostname - Hostname from the request URL.
 */
export function inferServiceFromHostname(hostname: string): string {
  const host = hostname.toLowerCase();

  if (host === 's3.amazonaws.com' || host.startsWith('s3.') || host.endsWith('.s3.amazonaws.com')) {
    return 's3';
  }
  if (host.includes('.execute-api.')) {
    return 'execute-api';
  }
  if (host.includes('.lambda.')) {
    return 'lambda';
  }
  if (host.includes('.dynamodb.')) {
    return 'dynamodb';
  }
  if (host.includes('.es.') || host.includes('.opensearch.')) {
    return 'es';
  }
  if (host.includes('.sts.')) {
    return 'sts';
  }

  const label = host.split('.')[0] ?? host;
  return label || 'execute-api';
}

/**
 * Parses a region from common AWS endpoint host patterns when not configured explicitly.
 *
 * @param hostname - Hostname from the request URL.
 */
export function inferRegionFromHostname(hostname: string): string | undefined {
  const host = hostname.toLowerCase();

  const executeApiMatch = /\.execute-api\.([a-z0-9-]+)\.amazonaws\.com$/.exec(host);
  if (executeApiMatch?.[1]) {
    return executeApiMatch[1];
  }

  const genericMatch = /\.([a-z0-9-]+)\.amazonaws\.com$/.exec(host);
  if (genericMatch?.[1] && genericMatch[1] !== 'amazonaws') {
    return genericMatch[1];
  }

  return undefined;
}
