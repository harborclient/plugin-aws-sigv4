// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/reactHost.js
var hostReact = null;
function setHostReact(react) {
  hostReact = react;
}
function requireHostReact() {
  if (hostReact == null) {
    throw new Error(
      "Plugin React host is not installed. Call installReact(hc.react) at the start of activate()."
    );
  }
  return hostReact;
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/index.js
function installReact(react) {
  setHostReact(react);
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/react.js
function hook(name) {
  const react = requireHostReact();
  const fn = react[name];
  if (typeof fn !== "function") {
    throw new Error(`React hook "${String(name)}" is not available on hc.react.`);
  }
  return fn;
}
function useState(initialState) {
  return hook("useState")(initialState);
}
function useEffect(effect, deps) {
  return hook("useEffect")(effect, deps);
}
function useCallback(callback, deps) {
  return hook("useCallback")(callback, deps);
}

// src/storage/keys.ts
var CONFIG_INDEX_KEY = "_aws-config-index";
function collectionStorageKey(collectionId) {
  return `collection:${collectionId}`;
}
function draftStorageKey(draft) {
  return `draft:${draft.method}:${draft.url}`;
}

// src/storage/defaults.ts
function defaultCollectionAwsConfig() {
  return {
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
    service: "",
    sessionToken: "",
    autoSign: true
  };
}
function defaultRequestAwsSettings() {
  return {
    collectionId: null,
    region: "",
    service: "",
    sessionToken: "",
    autoSign: true
  };
}
function parseCollectionAwsConfig(stored) {
  if (!stored || typeof stored !== "object") {
    return defaultCollectionAwsConfig();
  }
  const record = stored;
  return {
    accessKeyId: typeof record.accessKeyId === "string" ? record.accessKeyId : "",
    secretAccessKey: typeof record.secretAccessKey === "string" ? record.secretAccessKey : "",
    region: typeof record.region === "string" ? record.region : "us-east-1",
    service: typeof record.service === "string" ? record.service : "",
    sessionToken: typeof record.sessionToken === "string" ? record.sessionToken : "",
    autoSign: record.autoSign !== false
  };
}
function parseRequestAwsSettings(stored) {
  if (!stored || typeof stored !== "object") {
    return defaultRequestAwsSettings();
  }
  const record = stored;
  return {
    collectionId: typeof record.collectionId === "number" ? record.collectionId : null,
    region: typeof record.region === "string" ? record.region : "",
    service: typeof record.service === "string" ? record.service : "",
    sessionToken: typeof record.sessionToken === "string" ? record.sessionToken : "",
    autoSign: record.autoSign !== false
  };
}

// src/sync/configSync.ts
function emptyConfigIndex() {
  return { collections: [], requestKeys: [] };
}
function parseConfigIndex(stored) {
  if (!stored || typeof stored !== "object") {
    return emptyConfigIndex();
  }
  const record = stored;
  return {
    collections: Array.isArray(record.collections) ? record.collections.filter(
      (value) => typeof value === "number" && Number.isFinite(value)
    ) : [],
    requestKeys: Array.isArray(record.requestKeys) ? record.requestKeys.filter(
      (value) => typeof value === "string" && value.length > 0
    ) : []
  };
}
function registerCollectionInIndex(index, collectionId) {
  if (index.collections.includes(collectionId)) {
    return index;
  }
  return {
    ...index,
    collections: [...index.collections, collectionId].sort((a, b) => a - b)
  };
}
function registerRequestKeyInIndex(index, requestKey) {
  if (index.requestKeys.includes(requestKey)) {
    return index;
  }
  return {
    ...index,
    requestKeys: [...index.requestKeys, requestKey]
  };
}
async function loadConfigIndex(hc) {
  const stored = await hc.storage.get(CONFIG_INDEX_KEY);
  return parseConfigIndex(stored);
}
async function saveConfigIndex(hc, index) {
  await hc.storage.set(CONFIG_INDEX_KEY, index);
  await syncConfigToMain(hc, index);
}
async function buildConfigSnapshot(hc, index) {
  const collections = {};
  for (const collectionId of index.collections) {
    const stored = await hc.storage.get(collectionStorageKey(collectionId));
    collections[collectionId] = parseCollectionAwsConfig(stored);
  }
  const requests = {};
  const drafts = {};
  for (const key of index.requestKeys) {
    const stored = await hc.storage.get(key);
    const settings = parseRequestAwsSettings(stored);
    if (key.startsWith("draft:")) {
      drafts[key] = settings;
    } else {
      requests[key] = settings;
    }
  }
  return { collections, requests, drafts };
}
async function syncConfigToMain(hc, index) {
  const resolvedIndex = index ?? await loadConfigIndex(hc);
  const snapshot = await buildConfigSnapshot(hc, resolvedIndex);
  await hc.ipc.invoke("syncConfig", snapshot);
}
async function saveCollectionAwsConfig(hc, collectionId, config) {
  await hc.storage.set(collectionStorageKey(collectionId), config);
  const index = registerCollectionInIndex(await loadConfigIndex(hc), collectionId);
  await saveConfigIndex(hc, index);
}
async function saveRequestAwsSettings(hc, requestKey, settings) {
  await hc.storage.set(requestKey, settings);
  const index = registerRequestKeyInIndex(await loadConfigIndex(hc), requestKey);
  await saveConfigIndex(hc, index);
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/jsx-runtime.js
var Fragment = Symbol.for("@harborclient/sdk.Fragment");
function build(type, props, key) {
  const react = requireHostReact();
  const elementType = type === Fragment ? react.Fragment : type;
  const { children, ...rest } = props ?? {};
  if (key !== void 0) {
    rest.key = key;
  }
  return react.createElement(elementType, rest, children);
}
var jsx = build;
var jsxs = build;

// src/components/CollectionAwsTab.tsx
function CollectionAwsTab({ context, hc }) {
  const [config, setConfig] = useState(
    defaultCollectionAwsConfig()
  );
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const errorId = `aws-collection-error-${context.collectionId}`;
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    setSaved(false);
    void hc.storage.get(collectionStorageKey(context.collectionId)).then((stored) => {
      if (!cancelled) {
        setConfig(parseCollectionAwsConfig(stored));
      }
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load AWS settings.");
      }
    }).finally(() => {
      if (!cancelled) {
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [context.collectionId, hc.storage]);
  const handleSubmit = useCallback(
    async (event) => {
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
          submitError instanceof Error ? submitError.message : String(submitError)
        );
      } finally {
        setSaving(false);
      }
    },
    [config, context.collectionId, context.readOnly, hc]
  );
  const disabled = busy || saving || context.readOnly;
  return /* @__PURE__ */ jsxs("form", { className: "max-w-xl space-y-4", onSubmit: (event) => void handleSubmit(event), children: [
    /* @__PURE__ */ jsx("p", { className: "text-[14px] text-muted", children: "Configure default AWS credentials for requests in this collection. Per-request overrides are available on the AWS SigV4 request tab." }),
    /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Access Key ID" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          id: `aws-access-key-${context.collectionId}`,
          className: "w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]",
          value: config.accessKeyId,
          disabled,
          autoComplete: "off",
          "aria-invalid": error != null,
          "aria-describedby": error != null ? errorId : void 0,
          onChange: (event) => {
            setConfig((current) => ({
              ...current,
              accessKeyId: event.target.value
            }));
            setSaved(false);
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Secret Access Key" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          id: `aws-secret-key-${context.collectionId}`,
          type: "password",
          className: "w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]",
          value: config.secretAccessKey,
          disabled,
          autoComplete: "off",
          "aria-invalid": error != null,
          "aria-describedby": error != null ? errorId : void 0,
          onChange: (event) => {
            setConfig((current) => ({
              ...current,
              secretAccessKey: event.target.value
            }));
            setSaved(false);
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Region" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "w-full rounded border border-control bg-control px-3 py-2 text-[14px]",
            value: config.region,
            disabled,
            placeholder: "us-east-1",
            onChange: (event) => {
              setConfig((current) => ({ ...current, region: event.target.value }));
              setSaved(false);
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Service" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "w-full rounded border border-control bg-control px-3 py-2 text-[14px]",
            value: config.service,
            disabled,
            placeholder: "execute-api",
            onChange: (event) => {
              setConfig((current) => ({ ...current, service: event.target.value }));
              setSaved(false);
            }
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Session token (optional)" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]",
          value: config.sessionToken ?? "",
          disabled,
          autoComplete: "off",
          onChange: (event) => {
            setConfig((current) => ({
              ...current,
              sessionToken: event.target.value
            }));
            setSaved(false);
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-[14px] text-text", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: config.autoSign,
          disabled,
          onChange: (event) => {
            setConfig((current) => ({
              ...current,
              autoSign: event.target.checked
            }));
            setSaved(false);
          }
        }
      ),
      "Auto-sign matching requests on Send"
    ] }),
    error != null ? /* @__PURE__ */ jsx("p", { id: errorId, className: "text-[14px] text-danger", role: "status", children: error }) : null,
    saved ? /* @__PURE__ */ jsx("p", { className: "text-[14px] text-muted", role: "status", children: "Settings saved." }) : null,
    !context.readOnly ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "submit",
        className: "rounded bg-accent px-4 py-2 text-[14px] text-white disabled:opacity-50",
        disabled,
        children: saving ? "Saving\u2026" : "Save AWS settings"
      }
    ) : null
  ] });
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/http/substitute.js
var VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;
function substituteVariables(text, runtimeVars) {
  return text.replace(VARIABLE_PATTERN, (match, key) => {
    const value = runtimeVars[key];
    return value !== void 0 ? value : match;
  });
}
function resolveAuthVariables(auth, substitute) {
  return {
    ...auth,
    basic: {
      username: substitute(auth.basic.username),
      password: substitute(auth.basic.password)
    },
    bearer: {
      token: substitute(auth.bearer.token)
    }
  };
}
function substituteKeyValueRows(rows, runtimeVars) {
  return rows.map((row) => ({
    ...row,
    value: substituteVariables(row.value, runtimeVars)
  }));
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/http/resolveRequest.js
function hasUnsafeHeaderFieldChars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}
function encodeBasicAuth(username, password) {
  const credential = `${username}:${password}`;
  if (typeof TextEncoder !== "undefined" && typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(credential);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }
  return globalThis.btoa?.(credential) ?? credential;
}
function buildAuthHeaderValue(auth) {
  if (auth.type === "none") {
    return null;
  }
  if (auth.type === "basic") {
    const username = auth.basic.username.trim();
    const password = auth.basic.password;
    if (!username && !password.trim()) {
      return null;
    }
    return `Basic ${encodeBasicAuth(username, password)}`;
  }
  const token = auth.bearer.token.trim();
  if (!token || hasUnsafeHeaderFieldChars(token)) {
    return null;
  }
  return `Bearer ${token}`;
}
function isRootRelativePath(url) {
  return url.startsWith("/") && !url.startsWith("//");
}
function appendQueryFallback(trimmed, enabledParams) {
  const separator = trimmed.includes("?") ? "&" : "?";
  const query = enabledParams.map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`).join("&");
  return `${trimmed}${separator}${query}`;
}
function buildUrl(baseUrl, params) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }
  const enabledParams = params.filter((param) => param.enabled && param.key.trim());
  if (enabledParams.length === 0) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return trimmed;
    }
    for (const param of enabledParams) {
      url.searchParams.set(param.key.trim(), param.value);
    }
    return url.toString();
  } catch {
    if (!isRootRelativePath(trimmed)) {
      return trimmed;
    }
    return appendQueryFallback(trimmed, enabledParams);
  }
}
function enabledRows(rows) {
  return rows.filter((row) => row.enabled && row.key.trim());
}
function hasManualAuthorization(rows) {
  return enabledRows(rows).some((row) => row.key.trim().toLowerCase() === "authorization" && row.value.trim() !== "");
}
function buildHeaders(draft, collectionHeaders, authValue) {
  const mergedRows = [
    ...authValue && !hasManualAuthorization([...collectionHeaders, ...draft.headers]) ? [{ key: "Authorization", value: authValue, enabled: true }] : [],
    ...collectionHeaders,
    ...draft.headers
  ];
  const result = {};
  for (const header of enabledRows(mergedRows)) {
    const key = header.key.trim();
    if (draft.body_type === "multipart" && key.toLowerCase() === "content-type") {
      continue;
    }
    result[key] = header.value;
  }
  const hasContentType = Object.keys(result).some((key) => key.toLowerCase() === "content-type");
  if (!hasContentType) {
    if (draft.body_type === "json") {
      result["Content-Type"] = "application/json";
    } else if (draft.body_type === "text") {
      result["Content-Type"] = "text/plain";
    } else if (draft.body_type === "urlencoded") {
      result["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }
  return result;
}
function resolveRequest(context) {
  const { draft, collectionAuth, collectionHeaders, variables } = context;
  const substitute = (text) => substituteVariables(text, variables);
  const resolvedDraft = {
    ...draft,
    url: substitute(draft.url),
    body: substitute(draft.body),
    params: substituteKeyValueRows(draft.params, variables),
    headers: substituteKeyValueRows(draft.headers, variables),
    auth: resolveAuthVariables(draft.auth, substitute)
  };
  const resolvedCollectionHeaders = substituteKeyValueRows(collectionHeaders, variables);
  const resolvedCollectionAuth = resolveAuthVariables(collectionAuth, substitute);
  const effectiveAuth = resolvedDraft.auth.type !== "none" ? resolvedDraft.auth : resolvedCollectionAuth;
  const authValue = buildAuthHeaderValue(effectiveAuth);
  const url = buildUrl(resolvedDraft.url, resolvedDraft.params);
  const headers = buildHeaders(resolvedDraft, resolvedCollectionHeaders, authValue);
  return {
    method: resolvedDraft.method,
    url,
    headers,
    body: resolvedDraft.body
  };
}

// src/sync/signingContext.ts
function buildSigningConfigFromProfiles(collection, requestSettings) {
  if (requestSettings.collectionId == null) {
    return null;
  }
  if (!collection.accessKeyId.trim() || !collection.secretAccessKey.trim()) {
    return null;
  }
  return {
    accessKeyId: collection.accessKeyId,
    secretAccessKey: collection.secretAccessKey,
    region: requestSettings.region?.trim() || collection.region,
    service: requestSettings.service?.trim() || collection.service,
    sessionToken: requestSettings.sessionToken?.trim() || collection.sessionToken?.trim()
  };
}
function resolvedToPluginHttpRequest(resolved) {
  return {
    method: resolved.method,
    url: resolved.url,
    headers: { ...resolved.headers },
    body: resolved.body
  };
}
async function loadConfiguredCollections(hc) {
  const index = await loadConfigIndex(hc);
  const entries = [];
  for (const collectionId of index.collections) {
    const stored = await hc.storage.get(collectionStorageKey(collectionId));
    const config = parseCollectionAwsConfig(stored);
    if (config.accessKeyId.trim() && config.secretAccessKey.trim()) {
      entries.push({ id: collectionId, config });
    }
  }
  return entries.sort((left, right) => left.id - right.id);
}
async function previewSignActiveRequest(hc, context, requestSettings) {
  if (requestSettings.collectionId == null) {
    return {
      headers: {},
      errors: ["Select a credential profile collection before signing."]
    };
  }
  const stored = await hc.storage.get(
    collectionStorageKey(requestSettings.collectionId)
  );
  const collection = parseCollectionAwsConfig(stored);
  const signingConfig = buildSigningConfigFromProfiles(collection, requestSettings);
  if (!signingConfig) {
    return {
      headers: {},
      errors: ["Configure AWS credentials in Collection Settings before signing."]
    };
  }
  const resolved = resolveRequest(context);
  const request = resolvedToPluginHttpRequest(resolved);
  return hc.ipc.invoke("sign", {
    request,
    config: signingConfig
  });
}
async function loadRequestSettingsForContext(hc, context) {
  const key = draftStorageKey(context.draft);
  const stored = await hc.storage.get(key);
  return {
    key,
    settings: parseRequestAwsSettings(stored)
  };
}

// src/components/activeRequestBridge.ts
var activeBridge = null;
function setActiveRequestBridge(bridge) {
  activeBridge = bridge;
}
function getActiveRequestBridge() {
  return activeBridge;
}

// src/components/signPreviewState.ts
var preview = null;
var listeners = /* @__PURE__ */ new Set();
function getSignPreview() {
  return preview;
}
function showSignPreview(result) {
  preview = result;
  for (const listener of listeners) {
    listener();
  }
}
function clearSignPreview() {
  preview = null;
  for (const listener of listeners) {
    listener();
  }
}
function subscribeSignPreview(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// src/components/SignPreviewModal.tsx
function SignPreviewModal() {
  const [open, setOpen] = useState(() => getSignPreview() != null);
  const [preview2, setPreview] = useState(getSignPreview);
  useEffect(() => {
    return subscribeSignPreview(() => {
      setOpen(getSignPreview() != null);
      setPreview(getSignPreview());
    });
  }, []);
  const handleClose = useCallback(() => {
    clearSignPreview();
  }, []);
  const handleCopyAll = useCallback(async () => {
    if (!preview2) {
      return;
    }
    const text = Object.entries(preview2.headers).map(([key, value]) => `${key}: ${value}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
    }
  }, [preview2]);
  if (!open || !preview2) {
    return null;
  }
  const titleId = "aws-sign-preview-title";
  const hasErrors = (preview2.errors?.length ?? 0) > 0;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4",
      role: "presentation",
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      },
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: "flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-separator bg-surface shadow-lg",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-separator px-4 py-3", children: [
              /* @__PURE__ */ jsx("h2", { id: titleId, className: "text-[16px] font-medium text-text", children: "AWS SigV4 signature preview" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "rounded px-2 py-1 text-[14px] text-muted hover:bg-control",
                  "aria-label": "Close",
                  onClick: handleClose,
                  children: "Close"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-auto p-4", children: [
              /* @__PURE__ */ jsx("p", { className: "mb-4 text-[14px] text-muted", children: "Signatures are applied fresh on Send. Use this preview to validate credentials and copy headers if needed." }),
              hasErrors ? /* @__PURE__ */ jsx(
                "div",
                {
                  className: "mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-[14px] text-danger",
                  role: "status",
                  children: /* @__PURE__ */ jsx("ul", { className: "list-disc pl-5", children: preview2.errors?.map((message) => /* @__PURE__ */ jsx("li", { children: message }, message)) })
                }
              ) : null,
              !hasErrors && Object.keys(preview2.headers).length > 0 ? /* @__PURE__ */ jsx("dl", { className: "space-y-3", children: Object.entries(preview2.headers).map(([key, value]) => /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("dt", { className: "font-mono text-[14px] text-muted", children: key }),
                /* @__PURE__ */ jsx("dd", { className: "mt-1 break-all font-mono text-[14px] text-text", children: value })
              ] }, key)) }) : null
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-2 border-t border-separator px-4 py-3", children: [
              !hasErrors && Object.keys(preview2.headers).length > 0 ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "rounded border border-separator bg-control px-3 py-2 text-[14px] text-text",
                  onClick: () => void handleCopyAll(),
                  children: "Copy headers"
                }
              ) : null,
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "rounded bg-accent px-3 py-2 text-[14px] text-white",
                  onClick: handleClose,
                  children: "Done"
                }
              )
            ] })
          ]
        }
      )
    }
  );
}

// src/components/RequestAwsTab.tsx
function RequestAwsTab({ context, hc }) {
  const [settings, setSettings] = useState(
    defaultRequestAwsSettings()
  );
  const [settingsKey, setSettingsKey] = useState("");
  const [collections, setCollections] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);
  const errorId = "aws-request-error";
  useEffect(() => {
    setActiveRequestBridge({ context, hc });
    return () => {
      setActiveRequestBridge(null);
    };
  }, [context, hc]);
  useEffect(() => {
    let cancelled = false;
    void loadConfiguredCollections(hc).then((entries) => {
      if (cancelled) {
        return;
      }
      setCollections(
        entries.map((entry) => ({
          id: entry.id,
          label: `Collection #${entry.id} (${entry.config.region || "region?"})`
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [hc]);
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
  useEffect(() => {
    if (!loaded || !settingsKey) {
      return;
    }
    void saveRequestAwsSettings(hc, settingsKey, settings).catch(() => {
      setError("Failed to save request AWS settings.");
    });
  }, [hc, loaded, settings, settingsKey]);
  const handlePreviewSign = useCallback(async () => {
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
        previewError instanceof Error ? previewError.message : String(previewError)
      );
    } finally {
      setSigning(false);
    }
  }, [context, hc, settings]);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4 p-4", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[14px] text-muted", children: "Choose which collection credentials to use for this request and optionally override region or service. Signatures are applied automatically on Send when auto-sign is enabled." }),
    /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Credential profile" }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          className: "w-full max-w-md rounded border border-control bg-control px-3 py-2 text-[14px]",
          value: settings.collectionId ?? "",
          "aria-invalid": error != null,
          "aria-describedby": error != null ? errorId : void 0,
          onChange: (event) => {
            const value = event.target.value;
            setSettings((current) => ({
              ...current,
              collectionId: value === "" ? null : Number(value)
            }));
          },
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Select a collection\u2026" }),
            collections.map((entry) => /* @__PURE__ */ jsx("option", { value: entry.id, children: entry.label }, entry.id))
          ]
        }
      )
    ] }),
    collections.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-[14px] text-muted", role: "status", children: "Save AWS credentials under Collection Settings \u2192 AWS SigV4 first." }) : null,
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Region override" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "w-full rounded border border-control bg-control px-3 py-2 text-[14px]",
            value: settings.region ?? "",
            placeholder: "Uses collection default",
            onChange: (event) => {
              setSettings((current) => ({
                ...current,
                region: event.target.value
              }));
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Service override" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "w-full rounded border border-control bg-control px-3 py-2 text-[14px]",
            value: settings.service ?? "",
            placeholder: "Uses collection default or URL heuristic",
            onChange: (event) => {
              setSettings((current) => ({
                ...current,
                service: event.target.value
              }));
            }
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", children: "Session token override" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "w-full rounded border border-control bg-control px-3 py-2 font-mono text-[14px]",
          value: settings.sessionToken ?? "",
          placeholder: "Optional",
          onChange: (event) => {
            setSettings((current) => ({
              ...current,
              sessionToken: event.target.value
            }));
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-[14px] text-text", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: settings.autoSign,
          onChange: (event) => {
            setSettings((current) => ({
              ...current,
              autoSign: event.target.checked
            }));
          }
        }
      ),
      "Auto-sign this request on Send"
    ] }),
    error != null ? /* @__PURE__ */ jsx("p", { id: errorId, className: "text-[14px] text-danger", role: "status", children: error }) : null,
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "rounded border border-separator bg-control px-4 py-2 text-[14px] text-text disabled:opacity-50",
        disabled: signing || settings.collectionId == null,
        onClick: () => void handlePreviewSign(),
        children: signing ? "Signing\u2026" : "Preview signature"
      }
    ),
    /* @__PURE__ */ jsx(SignPreviewModal, {})
  ] });
}

// src/renderer.tsx
function activate(hc) {
  installReact(hc.react);
  function CollectionAwsTabHost({
    context
  }) {
    return /* @__PURE__ */ jsx(CollectionAwsTab, { context, hc });
  }
  hc.subscriptions.push(
    hc.ui.registerCollectionSettingsTab({
      id: "aws",
      title: "AWS SigV4",
      order: 60,
      Component: CollectionAwsTabHost
    }),
    hc.ui.registerRequestTab({
      id: "aws",
      title: "AWS SigV4",
      order: 60,
      Component: ({ context }) => /* @__PURE__ */ jsx(RequestAwsTab, { context, hc })
    }),
    hc.ui.registerRequestToolbarAction({
      id: "sign",
      title: "Sign request",
      command: "sign",
      order: 40
    })
  );
  hc.commands.register("sign", () => {
    void runToolbarSign(hc);
  });
  void syncConfigToMain(hc);
}
async function runToolbarSign(hc) {
  const bridge = getActiveRequestBridge();
  if (!bridge) {
    hc.ui.showToast("Open the AWS SigV4 request tab to sign this request.");
    return;
  }
  try {
    const { settings } = await loadRequestSettingsForContext(hc, bridge.context);
    const result = await previewSignActiveRequest(hc, bridge.context, settings);
    if (result.errors?.length) {
      hc.ui.showToast(result.errors[0] ?? "Signing failed.");
    }
    showSignPreview(result);
  } catch (error) {
    hc.ui.showToast(error instanceof Error ? error.message : String(error));
  }
}
export {
  activate
};
