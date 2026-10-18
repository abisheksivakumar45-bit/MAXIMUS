import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../lib/api';

/** Discriminated union describing the state of an async API resource. */
export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiError };

/**
 * Fetch a resource and expose explicit loading / success / error states.
 *
 * `loader` must be referentially stable (wrap it in useCallback) — otherwise
 * the effect re-runs on every render.
 */
export function useApiResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', data: null, error: null });

    loader()
      .then((data) => {
        if (active) {
          setState({ status: 'success', data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(0, 'An unexpected error occurred while loading data.');
        setState({ status: 'error', data: null, error: apiError });
      });

    return () => {
      active = false;
    };
  }, [loader, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, reload };
}
