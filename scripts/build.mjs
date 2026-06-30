import { buildRenderer } from '@harborclient/sdk/build';

await buildRenderer({
  jsxRuntime: 'runtime',
  aliasReactTo: '@harborclient/sdk/react',
  watch: process.argv.includes('--watch')
});
