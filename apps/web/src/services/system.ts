import { getJson } from '@/services/http';
import type { HealthResponse } from '@/types/system';

export function fetchHealth() {
  return getJson<HealthResponse>('/health');
}

