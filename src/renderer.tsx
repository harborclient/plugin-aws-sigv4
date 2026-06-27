import { installReact } from '@harborclient/sdk';
import type { PluginContext } from '@harborclient/sdk';
import { CollectionAwsTab } from './components/CollectionAwsTab';
import { RequestAwsTab } from './components/RequestAwsTab';
import { getActiveRequestBridge } from './components/activeRequestBridge';
import { showSignPreview } from './components/signPreviewState';
import { loadRequestSettingsForContext, previewSignActiveRequest } from './sync/signingContext';
import { syncConfigToMain } from './sync/configSync';

/**
 * Activates the renderer half and registers AWS SigV4 UI contributions.
 *
 * @param hc - Renderer plugin context from the HarborClient host.
 */
export function activate(hc: PluginContext): void {
  installReact(hc.react);

  /**
   * Collection settings tab host that closes over the plugin context.
   */
  function CollectionAwsTabHost({
    context
  }: {
    context: Parameters<typeof CollectionAwsTab>[0]['context'];
  }) {
    return <CollectionAwsTab context={context} hc={hc} />;
  }

  hc.subscriptions.push(
    hc.ui.registerCollectionSettingsTab({
      id: 'aws',
      title: 'AWS SigV4',
      order: 60,
      Component: CollectionAwsTabHost
    }),
    hc.ui.registerRequestTab({
      id: 'aws',
      title: 'AWS SigV4',
      order: 60,
      Component: ({ context }) => <RequestAwsTab context={context} hc={hc} />
    }),
    hc.ui.registerRequestToolbarAction({
      id: 'sign',
      title: 'Sign request',
      command: 'sign',
      order: 40
    })
  );

  hc.commands.register('sign', () => {
    void runToolbarSign(hc);
  });

  void syncConfigToMain(hc);
}

/**
 * Runs the toolbar sign preview using the active request bridge, if available.
 *
 * @param hc - Renderer plugin context.
 */
async function runToolbarSign(hc: PluginContext): Promise<void> {
  const bridge = getActiveRequestBridge();
  if (!bridge) {
    hc.ui.showToast('Open the AWS SigV4 request tab to sign this request.');
    return;
  }

  try {
    const { settings } = await loadRequestSettingsForContext(hc, bridge.context);
    const result = await previewSignActiveRequest(hc, bridge.context, settings);
    if (result.errors?.length) {
      hc.ui.showToast(result.errors[0] ?? 'Signing failed.');
    }
    showSignPreview(result);
  } catch (error) {
    hc.ui.showToast(error instanceof Error ? error.message : String(error));
  }
}
