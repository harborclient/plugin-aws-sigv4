import { useCallback, useEffect, useState } from "@harborclient/sdk/react";
import type { PluginContext, RequestTabContext } from "@harborclient/sdk";
import type { RequestAwsSettings } from "../types";
import { defaultRequestAwsSettings } from "../storage/defaults";
import { saveRequestAwsSettings } from "../sync/configSync";
import {
  loadConfiguredCollections,
  loadRequestSettingsForContext,
  previewSignActiveRequest,
} from "../sync/signingContext";
import { setActiveRequestBridge } from "./activeRequestBridge";
import { showSignPreview } from "./signPreviewState";
import { SignPreviewModal } from "./SignPreviewModal";

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
  const [settings, setSettings] = useState<RequestAwsSettings>(
    defaultRequestAwsSettings()
  );
  const [settingsKey, setSettingsKey] = useState("");
  const [collections, setCollections] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = "aws-request-error";

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
          label: `Collection #${entry.id} (${
            entry.config.region || "region?"
          })`,
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

    void loadRequestSettingsForContext(hc, context).then(
      ({ key, settings: stored }) => {
        if (cancelled) {
          return;
        }
        setSettingsKey(key);
        setSettings(stored);
        setLoaded(true);
      }
    );

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
      setError("Failed to save request AWS settings.");
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
        setError(result.errors.join(" "));
      }
      showSignPreview(result);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : String(previewError)
      );
    } finally {
      setSigning(false);
    }
  }, [context, hc, settings]);

  return (
    <div className="space-y-4 p-4">
      <p className="text-[14px] text-muted">
        Choose which collection credentials to use for this request and
        optionally override region or service. Signatures are applied
        automatically on Send when auto-sign is enabled.
      </p>

      <label className="block space-y-1">
        <span className="text-[14px] text-text">Credential profile</span>
        <select
          className="w-full max-w-md rounded border border-control bg-control px-3 py-2 text-[14px]"
          value={settings.collectionId ?? ""}
          aria-invalid={error != null}
          aria-describedby={error != null ? errorId : undefined}
          onChange={(event) => {
            const value = event.target.value;
            setSettings((current) => ({
              ...current,
              collectionId: value === "" ? null : Number(value),
            }));
          }}
        >
          <option value="">Select a collection…</option>
          {collections.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      {collections.length === 0 ? (
        <p className="text-[14px] text-muted" role="status">
          Save AWS credentials under Collection Settings → AWS SigV4 first.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[14px] text-text">Region override</span>
          <input
            className="w-full rounded border border-control bg-control px-3 py-2 text-[14px]"
            value={settings.region ?? ""}
            placeholder="Uses collection default"
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                region: event.target.value,
              }));
            }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[14px] text-text">Service override</span>
          <input
            className="w-full rounded border border-control bg-control px-3 py-2 text-[14px]"
            value={settings.service ?? ""}
            placeholder="Uses collection default or URL heuristic"
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                service: event.target.value,
              }));
            }}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[14px] text-text">Session token override</span>
        <input
          className="w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]"
          value={settings.sessionToken ?? ""}
          placeholder="Optional"
          onChange={(event) => {
            setSettings((current) => ({
              ...current,
              sessionToken: event.target.value,
            }));
          }}
        />
      </label>

      <label className="flex items-center gap-2 text-[14px] text-text">
        <input
          type="checkbox"
          checked={settings.autoSign}
          onChange={(event) => {
            setSettings((current) => ({
              ...current,
              autoSign: event.target.checked,
            }));
          }}
        />
        Auto-sign this request on Send
      </label>

      {error != null ? (
        <p id={errorId} className="text-[14px] text-danger" role="status">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="rounded border border-separator bg-control px-4 py-2 text-[14px] text-text disabled:opacity-50"
        disabled={signing || settings.collectionId == null}
        onClick={() => void handlePreviewSign()}
      >
        {signing ? "Signing…" : "Preview signature"}
      </button>

      <SignPreviewModal />
    </div>
  );
}
