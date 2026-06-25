import { useCallback, useEffect, useState } from "@harborclient/sdk/react";
import {
  clearSignPreview,
  getSignPreview,
  subscribeSignPreview,
} from "./signPreviewState";

/**
 * Accessible modal that displays signed AWS headers for copy and review.
 */
export function SignPreviewModal() {
  const [open, setOpen] = useState(() => getSignPreview() != null);
  const [preview, setPreview] = useState(getSignPreview);

  /**
   * Subscribes to preview open/close events from toolbar and request tab actions.
   */
  useEffect(() => {
    return subscribeSignPreview(() => {
      setOpen(getSignPreview() != null);
      setPreview(getSignPreview());
    });
  }, []);

  /**
   * Closes the modal and clears preview state.
   */
  const handleClose = useCallback((): void => {
    clearSignPreview();
  }, []);

  /**
   * Copies all signed headers to the clipboard as `Name: value` lines.
   */
  const handleCopyAll = useCallback(async (): Promise<void> => {
    if (!preview) {
      return;
    }
    const text = Object.entries(preview.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be unavailable; ignore silently.
    }
  }, [preview]);

  if (!open || !preview) {
    return null;
  }

  const titleId = "aws-sign-preview-title";
  const hasErrors = (preview.errors?.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-separator bg-surface shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-separator px-4 py-3">
          <h2 id={titleId} className="text-[16px] font-medium text-text">
            AWS SigV4 signature preview
          </h2>
          <button
            type="button"
            className="rounded px-2 py-1 text-[14px] text-muted hover:bg-control"
            aria-label="Close"
            onClick={handleClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <p className="mb-4 text-[14px] text-muted">
            Signatures are applied fresh on Send. Use this preview to validate
            credentials and copy headers if needed.
          </p>

          {hasErrors ? (
            <div
              className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-[14px] text-danger"
              role="status"
            >
              <ul className="list-disc pl-5">
                {preview.errors?.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!hasErrors && Object.keys(preview.headers).length > 0 ? (
            <dl className="space-y-3">
              {Object.entries(preview.headers).map(([key, value]) => (
                <div key={key}>
                  <dt className="font-mono text-[14px] text-muted">{key}</dt>
                  <dd className="mt-1 break-all font-mono text-[14px] text-text">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-separator px-4 py-3">
          {!hasErrors && Object.keys(preview.headers).length > 0 ? (
            <button
              type="button"
              className="rounded border border-separator bg-control px-3 py-2 text-[14px] text-text"
              onClick={() => void handleCopyAll()}
            >
              Copy headers
            </button>
          ) : null}
          <button
            type="button"
            className="rounded bg-accent px-3 py-2 text-[14px] text-white"
            onClick={handleClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Host component mounted once at plugin activation to render preview modals globally.
 */
export function SignPreviewHost() {
  return <SignPreviewModal />;
}
