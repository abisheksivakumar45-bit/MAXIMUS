import { useCallback } from 'react';

import { api } from '../lib/api';
import { useApiResource } from './useApiResource';

/**
 * Load backend service information and database readiness.
 *
 * The two probes are independent: if the API process is up but PostgreSQL is
 * unreachable, `health` succeeds while `readiness` fails with HTTP 503.
 */
export function useServiceHealth() {
  const loadHealth = useCallback(() => api.getHealth(), []);
  const loadReadiness = useCallback(() => api.getReadiness(), []);

  return {
    health: useApiResource(loadHealth),
    readiness: useApiResource(loadReadiness),
  };
}
