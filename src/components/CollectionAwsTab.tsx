import { useCallback, useEffect, useState } from "@harborclient/sdk/react";
import type { CollectionSettingsTabContext } from "@harborclient/sdk";
import type { PluginContext } from "@harborclient/sdk";
import type { CollectionAwsConfig } from "../types";
import { collectionStorageKey } from "../storage/keys";
import {
  defaultCollectionAwsConfig,
  parseCollectionAwsConfig,
} from "../storage/defaults";
import { saveCollectionAwsConfig } from "../sync/configSync";

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
  const [config, setConfig] = useState<CollectionAwsConfig>(
    defaultCollectionAwsConfig()
  );
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const errorId = `aws-collection-error-${context.collectionId}`;

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
          setError("Failed to load AWS settings.");
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
        hc.ui.showToast("AWS credentials saved");
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : String(submitError)
        );
      } finally {
        setSaving(false);
      }
    },
    [config, context.collectionId, context.readOnly, hc]
  );

  const disabled = busy || saving || context.readOnly;

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <p className="text-[14px] text-muted">
        Configure default AWS credentials for requests in this collection.
        Per-request overrides are available on the AWS SigV4 request tab.
      </p>

      <label className="block space-y-1">
        <span className="text-[14px] text-text">Access Key ID</span>
        <input
          id={`aws-access-key-${context.collectionId}`}
          className="w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]"
          value={config.accessKeyId}
          disabled={disabled}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={error != null ? errorId : undefined}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              accessKeyId: event.target.value,
            }));
            setSaved(false);
          }}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[14px] text-text">Secret Access Key</span>
        <input
          id={`aws-secret-key-${context.collectionId}`}
          type="password"
          className="w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]"
          value={config.secretAccessKey}
          disabled={disabled}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={error != null ? errorId : undefined}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              secretAccessKey: event.target.value,
            }));
            setSaved(false);
          }}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[14px] text-text">Region</span>
          <input
            className="w-full rounded border border-control bg-control px-3 py-2 text-[14px]"
            value={config.region}
            disabled={disabled}
            placeholder="us-east-1"
            onChange={(event) => {
              setConfig((current) => ({
                ...current,
                region: event.target.value,
              }));
              setSaved(false);
            }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[14px] text-text">Service</span>
          <input
            className="w-full rounded border border-control bg-control px-3 py-2 text-[14px]"
            value={config.service}
            disabled={disabled}
            placeholder="execute-api"
            onChange={(event) => {
              setConfig((current) => ({
                ...current,
                service: event.target.value,
              }));
              setSaved(false);
            }}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[14px] text-text">Session token (optional)</span>
        <input
          className="w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]"
          value={config.sessionToken ?? ""}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              sessionToken: event.target.value,
            }));
            setSaved(false);
          }}
        />
      </label>

      <label className="flex items-center gap-2 text-[14px] text-text">
        <input
          type="checkbox"
          checked={config.autoSign}
          disabled={disabled}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              autoSign: event.target.checked,
            }));
            setSaved(false);
          }}
        />
        Auto-sign matching requests on Send
      </label>

      {error != null ? (
        <p id={errorId} className="text-[14px] text-danger" role="status">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="text-[14px] text-muted" role="status">
          Settings saved.
        </p>
      ) : null}

      {!context.readOnly ? (
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-[14px] text-white disabled:opacity-50"
          disabled={disabled}
        >
          {saving ? "Saving…" : "Save AWS settings"}
        </button>
      ) : null}
    </form>
  );
}
