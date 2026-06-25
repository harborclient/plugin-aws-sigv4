# AWS SigV4

HarborClient plugin that signs outgoing HTTP requests with AWS Signature Version 4.

## Features

- Collection Settings tab for access key, secret, region, service, and optional session token
- Request editor tab for per-request credential profile selection and overrides
- Automatic signing on Send via the main-process `onBeforeSend` hook
- Toolbar **Sign request** action for signature preview and validation

## Setup

```bash
pnpm install
pnpm build
```

Load this folder in HarborClient via **Settings → Plugins → Load unpacked…**.

Requires HarborClient `>=1.8.4` and `@harborclient/sdk@^0.4.3`.

## Development

```bash
pnpm dev
```

Rebuilds `dist/renderer.js` and `dist/main.js` on change.

## Usage

1. Open **Collection Settings → AWS SigV4** and save credentials for a collection.
2. Open a request and switch to the **AWS SigV4** tab.
3. Select the credential profile and enable **Auto-sign this request on Send**.
4. Send the request — `Authorization` and `X-Amz-*` headers are injected automatically.

Use **Preview signature** or the toolbar **Sign request** button (while the AWS tab is open) to validate credentials before sending.

## Sign and verify

```bash
pnpm plugin:sign -- --dir . --private-key /path/to/signing.pem --key-id harborclient-official
pnpm plugin:verify -- --dir . --public-key /path/to/public.key
```

See the [@harborclient/sdk signing docs](https://harborclient.github.io/sdk/signing) for key generation and `signature.json` format.

## Pack

```bash
pnpm pack
```

Creates `aws-sigv4.hcp` for distribution.
