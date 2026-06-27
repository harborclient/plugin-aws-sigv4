import { useCallback, useEffect, useState } from '@harborclient/sdk/react';
import {
  Button,
  FormGroup,
  Input,
  StatusMessage,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import type { CollectionSettingsTabContext } from '@harborclient/sdk';
import type { PluginContext } from '@harborclient/sdk';
import type { CollectionAwsConfig } from '../types';
import { collectionStorageKey } from '../storage/keys';
import { defaultCollectionAwsConfig, parseCollectionAwsConfig } from '../storage/defaults';
import { saveCollectionAwsConfig } from '../sync/configSync';

interface Props {
  /**
   * Collection settings tab context from the host.
   */
  context: CollectionSettingsTabContext;

  /**
   * Renderer plugin context for storage and IPC.
   */
  hc: PluginContext;
}

/**
 * Collection settings tab for AWS SigV4 credentials and defaults.
 */
export function CollectionAwsTab({ context, hc }: Props) {
  const [config, setConfig] = useState<CollectionAwsConfig>(defaultCollectionAwsConfig());
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const accessKeyId = `aws-access-key-${context.collectionId}`;
  const secretKeyId = `aws-secret-key-${context.collectionId}`;
  const autoSignId = `aws-auto-sign-${context.collectionId}`;

  /**
   * Loads persisted collection credentials when the tab opens or collection changes.
   */
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    setSaved(false);

    void hc.storage
      .get<CollectionAwsConfig>(collectionStorageKey(context.collectionId))
      .then((stored) => {
        if (!cancelled) {
          setConfig(parseCollectionAwsConfig(stored));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load AWS settings.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [context.collectionId, hc.storage]);

  /**
   * Persists collection AWS credentials and syncs them to the main runtime.
   *
   * @param event - Form submit event.
   */
  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (context.readOnly) {
        return;
      }

      setSaving(true);
      setError(null);
      setSaved(false);

      try {
        await saveCollectionAwsConfig(hc, context.collectionId, config);
        setSaved(true);
        hc.ui.showToast('AWS credentials saved');
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : String(submitError));
      } finally {
        setSaving(false);
      }
    },
    [config, context.collectionId, context.readOnly, hc]
  );

  const disabled = busy || saving || context.readOnly;

  return (
    <form className="max-w-xl space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <p className="text-[14px] text-muted">
        Configure default AWS credentials for requests in this collection. Per-request overrides are
        available on the AWS SigV4 request tab.
      </p>

      <fieldset disabled={disabled} className="m-0 space-y-4 border-0 p-0">
        <FormGroup label="Access Key ID" htmlFor={accessKeyId} error={error ?? undefined}>
          <VariableInput
            id={accessKeyId}
            variables={[]}
            value={config.accessKeyId}
            wrapperClassName={`w-full ${fieldFrame}`}
            className="font-mono"
            onChange={(value) => {
              setConfig((current) => ({
                ...current,
                accessKeyId: value
              }));
              setSaved(false);
            }}
          />
        </FormGroup>

        <FormGroup label="Secret Access Key" htmlFor={secretKeyId}>
          <Input
            id={secretKeyId}
            type="password"
            variant="control"
            className="w-full font-mono"
            value={config.secretAccessKey}
            autoComplete="off"
            onChange={(event) => {
              setConfig((current) => ({
                ...current,
                secretAccessKey: event.target.value
              }));
              setSaved(false);
            }}
          />
        </FormGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Region" htmlFor={`aws-region-${context.collectionId}`}>
            <VariableInput
              id={`aws-region-${context.collectionId}`}
              variables={[]}
              value={config.region}
              placeholder="us-east-1"
              wrapperClassName={`w-full ${fieldFrame}`}
              onChange={(value) => {
                setConfig((current) => ({
                  ...current,
                  region: value
                }));
                setSaved(false);
              }}
            />
          </FormGroup>

          <FormGroup label="Service" htmlFor={`aws-service-${context.collectionId}`}>
            <VariableInput
              id={`aws-service-${context.collectionId}`}
              variables={[]}
              value={config.service}
              placeholder="execute-api"
              wrapperClassName={`w-full ${fieldFrame}`}
              onChange={(value) => {
                setConfig((current) => ({
                  ...current,
                  service: value
                }));
                setSaved(false);
              }}
            />
          </FormGroup>
        </div>

        <FormGroup
          label="Session token (optional)"
          htmlFor={`aws-session-token-${context.collectionId}`}
        >
          <VariableInput
            id={`aws-session-token-${context.collectionId}`}
            variables={[]}
            value={config.sessionToken ?? ''}
            wrapperClassName={`w-full ${fieldFrame}`}
            className="font-mono"
            onChange={(value) => {
              setConfig((current) => ({
                ...current,
                sessionToken: value
              }));
              setSaved(false);
            }}
          />
        </FormGroup>

        <FormGroup
          label="Auto-sign matching requests on Send"
          htmlFor={autoSignId}
          layout="checkbox"
        >
          <Input
            id={autoSignId}
            type="checkbox"
            checked={config.autoSign}
            onChange={(event) => {
              setConfig((current) => ({
                ...current,
                autoSign: event.target.checked
              }));
              setSaved(false);
            }}
          />
        </FormGroup>

        {saved ? <StatusMessage>Settings saved.</StatusMessage> : null}

        {!context.readOnly ? (
          <Button type="submit" variant="primary">
            {saving ? 'Saving…' : 'Save AWS settings'}
          </Button>
        ) : null}
      </fieldset>
    </form>
  );
}
