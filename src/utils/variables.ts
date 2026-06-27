import { substituteVariables } from '@harborclient/sdk/http';
import type { Variable } from '@harborclient/sdk';

/**
 * Credential string fields that may contain {{variable}} placeholders.
 */
export interface CredentialFields {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  sessionToken?: string;
}

/**
 * Converts merged runtime variables to the collection {@link Variable} shape for {@link VariableInput}.
 *
 * @param variables - Merged global, collection, and environment values from the request tab.
 */
export function runtimeVariablesToVariableList(variables: Record<string, string>): Variable[] {
  return Object.entries(variables).map(([key, value]) => ({
    key,
    value,
    defaultValue: '',
    share: false
  }));
}

/**
 * Resolves {{variable}} placeholders in credential fields using send-time variable rules.
 *
 * @param fields - Raw credential strings from storage.
 * @param runtimeVars - Merged runtime variables; empty when none are synced yet.
 */
export function resolveCredentialFields(
  fields: CredentialFields,
  runtimeVars: Record<string, string>
): CredentialFields {
  const resolve = (text: string | undefined): string | undefined => {
    if (text == null || text === '') {
      return text;
    }
    return substituteVariables(text, runtimeVars);
  };

  return {
    accessKeyId: resolve(fields.accessKeyId) ?? '',
    secretAccessKey: resolve(fields.secretAccessKey) ?? '',
    region: resolve(fields.region) ?? '',
    service: resolve(fields.service) ?? '',
    sessionToken: resolve(fields.sessionToken)
  };
}
