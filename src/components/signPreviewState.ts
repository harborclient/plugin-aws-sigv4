import type { SignResult } from "../types";

let preview: SignResult | null = null;
const listeners = new Set<() => void>();

/**
 * Returns the current sign preview payload when the modal is open.
 */
export function getSignPreview(): SignResult | null {
  return preview;
}

/**
 * Opens the sign preview modal with signed headers or errors.
 *
 * @param result - Signing result to display.
 */
export function showSignPreview(result: SignResult): void {
  preview = result;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Closes the sign preview modal.
 */
export function clearSignPreview(): void {
  preview = null;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Subscribes to sign preview open/close events.
 *
 * @param listener - Callback invoked when preview state changes.
 */
export function subscribeSignPreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
