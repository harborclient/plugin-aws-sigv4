import { useCallback, useEffect, useMemo, useState } from '@harborclient/sdk/react';
import {
  Button,
  FormGroup,
  Input,
  Select,
  StatusMessage,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import type { PluginContext, RequestTabContext } from '@harborclient/sdk';
import type { RequestAwsSettings } from '../types';
import { defaultRequestAwsSettings } from '../storage/defaults';
import { saveRequestAwsSettings, syncConfigToMain } from '../sync/configSync';
import {
  loadConfiguredCollections,
  loadRequestSettingsForContext,
  previewSignActiveRequest
} from '../sync/signingContext';
import { runtimeVariablesToVariableList } from '../utils/variables';
import { setActiveRequestBridge } from './activeRequestBridge';
import { showSignPreview } from './signPreviewState';
import { SignPreviewModal } from './SignPreviewModal';

interface Props {
  /**
   * Read-only request tab context from the host.
   */
  context: RequestTabContext;

  /**
   * Renderer plugin context for storage and IPC.
   */
  hc: PluginContext;
}

/**
 * Request editor tab for per-request AWS overrides and signature preview.
 */
export function RequestAwsTab({ context, hc }: Props) {
  const [settings, setSettings] = useState<RequestAwsSettings>(defaultRequestAwsSettings());
  const [settingsKey, setSettingsKey] = useState('');
  const [collections, setCollections] = useState<Array<{ id: number; label: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileId = 'aws-credential-profile';
  const autoSignId = 'aws-request-auto-sign';
  const variables = useMemo(
    () => runtimeVariablesToVariableList(context.variables),
    [context.variables]
  );

  /**
   * Registers this tab as the active request bridge for toolbar actions.
   */
  useEffect(() => {
    setActiveRequestBridge({ context, hc });
    return () => {
      setActiveRequestBridge(null);
    };
  }, [context, hc]);

  /**
   * Keeps merged runtime variables synced to main for auto-sign substitution.
   */
  useEffect(() => {
    void syncConfigToMain(hc);
  }, [context.variables, hc]);

  /**
   * Loads configured collection profiles for the credential picker.
   */
  useEffect(() => {
    let cancelled = false;
    void loadConfiguredCollections(hc).then((entries) => {
      if (cancelled) {
        return;
      }
      setCollections(
        entries.map((entry) => ({
          id: entry.id,
          label: `Collection #${entry.id} (${entry.config.region || 'region?'})`
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [hc]);

  /**
   * Loads persisted per-request settings when the request fingerprint changes.
   */
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);

    void loadRequestSettingsForContext(hc, context).then(({ key, settings: stored }) => {
      if (cancelled) {
        return;
      }
      setSettingsKey(key);
      setSettings(stored);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [context.draft.method, context.draft.url, hc, context]);

  /**
   * Persists per-request settings and syncs them to the main runtime.
   */
  useEffect(() => {
    if (!loaded || !settingsKey) {
      return;
    }
    void saveRequestAwsSettings(hc, settingsKey, settings).catch(() => {
      setError('Failed to save request AWS settings.');
    });
  }, [hc, loaded, settings, settingsKey]);

  /**
   * Runs a signature preview for the active request using configured credentials.
   */
  const handlePreviewSign = useCallback(async (): Promise<void> => {
    setSigning(true);
    setError(null);
    try {
      const result = await previewSignActiveRequest(hc, context, settings);
      if (result.errors?.length) {
        setError(result.errors.join(' '));
      }
      showSignPreview(result);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setSigning(false);
    }
  }, [context, hc, settings]);

  return (
    <div className="space-y-4 p-4">
      <p className="text-[14px] text-muted">
        Choose which collection credentials to use for this request and optionally override region
        or service. Signatures are applied automatically on Send when auto-sign is enabled.
      </p>

      <FormGroup label="Credential profile" htmlFor={profileId} error={error ?? undefined}>
        <Select
          id={profileId}
          variant="control"
          className="w-full max-w-md"
          value={settings.collectionId ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            setSettings((current) => ({
              ...current,
              collectionId: value === '' ? null : Number(value)
            }));
          }}
        >
          <option value="">Select a collection…</option>
          {collections.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </Select>
      </FormGroup>

      {collections.length === 0 ? (
        <StatusMessage>
          Save AWS credentials under Collection Settings → AWS SigV4 first.
        </StatusMessage>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormGroup label="Region override" htmlFor="aws-region-override">
          <VariableInput
            id="aws-region-override"
            variables={variables}
            value={settings.region ?? ''}
            placeholder="Uses collection default"
            wrapperClassName={`w-full ${fieldFrame}`}
            onChange={(value) => {
              setSettings((current) => ({
                ...current,
                region: value
              }));
            }}
          />
        </FormGroup>

        <FormGroup label="Service override" htmlFor="aws-service-override">
          <VariableInput
            id="aws-service-override"
            variables={variables}
            value={settings.service ?? ''}
            placeholder="Uses collection default or URL heuristic"
            wrapperClassName={`w-full ${fieldFrame}`}
            onChange={(value) => {
              setSettings((current) => ({
                ...current,
                service: value
              }));
            }}
          />
        </FormGroup>
      </div>

      <FormGroup label="Session token override" htmlFor="aws-session-override">
        <VariableInput
          id="aws-session-override"
          variables={variables}
          value={settings.sessionToken ?? ''}
          placeholder="Optional"
          wrapperClassName={`w-full ${fieldFrame}`}
          className="font-mono"
          onChange={(value) => {
            setSettings((current) => ({
              ...current,
              sessionToken: value
            }));
          }}
        />
      </FormGroup>

      <FormGroup label="Auto-sign this request on Send" htmlFor={autoSignId} layout="checkbox">
        <Input
          id={autoSignId}
          type="checkbox"
          checked={settings.autoSign}
          onChange={(event) => {
            setSettings((current) => ({
              ...current,
              autoSign: event.target.checked
            }));
          }}
        />
      </FormGroup>

      <Button
        type="button"
        variant="secondary"
        disabled={signing || settings.collectionId == null}
        onClick={() => void handlePreviewSign()}
      >
        {signing ? 'Signing…' : 'Preview signature'}
      </Button>

      <SignPreviewModal hc={hc} />
    </div>
  );
}
