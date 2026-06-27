import type { DependencyList, ForwardRefRenderFunction, Ref } from 'react';
import * as sdkReact from '@harborclient/sdk/react';

export * from '@harborclient/sdk/react';

let hostReact: typeof import('react') | null = null;

/**
 * Installs the HarborClient host React instance for transitive dependency shims.
 *
 * Call alongside `installReact(hc.react)` at the start of `activate()`.
 *
 * @param react - React namespace from `hc.react`.
 */
export function installReactShim(react: typeof import('react')): void {
  hostReact = react;
}

function requireHostReact(): typeof import('react') {
  if (hostReact == null) {
    throw new Error(
      'Plugin React shim is not installed. Call installReactShim(hc.react) at the start of activate().'
    );
  }
  return hostReact;
}

/**
 * Defers host React lookup until render so module-level `React.forwardRef(...)`
 * calls (e.g. from @fortawesome/react-fontawesome) work before activate().
 */
export function forwardRef<T, P>(
  render: ForwardRefRenderFunction<T, P>
): ReturnType<(typeof import('react'))['forwardRef']> {
  let forwarded: ReturnType<(typeof import('react'))['forwardRef']> | null = null;

  function LazyForwardRef(props: P, ref: Ref<T>) {
    const react = requireHostReact();
    if (forwarded === null) {
      forwarded = react.forwardRef(render as never);
    }
    return react.createElement(forwarded, { ...(props as object), ref } as never);
  }

  const displayName = render.displayName ?? render.name ?? 'Component';
  LazyForwardRef.displayName = `ForwardRef(${displayName})`;

  return LazyForwardRef as unknown as ReturnType<(typeof import('react'))['forwardRef']>;
}

/** @type {typeof import('react').useImperativeHandle} */
export function useImperativeHandle<T>(
  ref: Ref<T>,
  create: () => T,
  deps?: DependencyList
) {
  return requireHostReact().useImperativeHandle(ref, create, deps);
}

const defaultExport = new Proxy(sdkReact, {
  get(target, prop, receiver) {
    if (prop === 'forwardRef') {
      return forwardRef;
    }
    if (prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    return requireHostReact()[prop as keyof typeof import('react')];
  }
});

export default defaultExport;
