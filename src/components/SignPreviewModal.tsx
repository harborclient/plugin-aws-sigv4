import type { ReactPortal } from 'react';
import { useCallback, useEffect, useState } from '@harborclient/sdk/react';
import {
  Button,
  Modal,
  ModalFooter,
  StatusMessage,
  portalToBody
} from '@harborclient/sdk/components';
import { copyToClipboard } from '@harborclient/sdk/clipboard';
import type { PluginContext } from '@harborclient/sdk';
import { clearSignPreview, getSignPreview, subscribeSignPreview } from './signPreviewState';

interface Props {
  /**
   * Renderer plugin context for clipboard and toast feedback.
   */
  hc: PluginContext;
}

/**
 * Accessible modal that displays signed AWS headers for copy and review.
 */
export function SignPreviewModal({ hc }: Props): ReactPortal | null {
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
      .join('\n');
    try {
      await copyToClipboard(hc, text, { toast: 'Headers copied' });
    } catch {
      // Clipboard may be unavailable; ignore silently.
    }
  }, [hc, preview]);

  if (!open || !preview) {
    return null;
  }

  const titleId = 'aws-sign-preview-title';
  const hasErrors = (preview.errors?.length ?? 0) > 0;

  return portalToBody(
    <Modal
      labelledBy={titleId}
      title="AWS SigV4 signature preview"
      onClose={handleClose}
      className="flex max-h-[80vh] w-full max-w-2xl flex-col"
    >
      <p className="mb-4 text-[14px] text-muted">
        Signatures are applied fresh on Send. Use this preview to validate credentials and copy
        headers if needed.
      </p>

      {hasErrors ? (
        <StatusMessage live className="mb-4 text-danger">
          <ul className="list-disc pl-5">
            {preview.errors?.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </StatusMessage>
      ) : null}

      {!hasErrors && Object.keys(preview.headers).length > 0 ? (
        <dl className="space-y-3 overflow-auto">
          {Object.entries(preview.headers).map(([key, value]) => (
            <div key={key}>
              <dt className="font-mono text-[14px] text-muted">{key}</dt>
              <dd className="mt-1 break-all font-mono text-[14px] text-text">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ModalFooter spaced>
        {!hasErrors && Object.keys(preview.headers).length > 0 ? (
          <Button type="button" variant="secondary" onClick={() => void handleCopyAll()}>
            Copy headers
          </Button>
        ) : null}
        <Button type="button" variant="primary" onClick={handleClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/**
 * Host component mounted once at plugin activation to render preview modals globally.
 */
export function SignPreviewHost({ hc }: Props) {
  return <SignPreviewModal hc={hc} />;
}
