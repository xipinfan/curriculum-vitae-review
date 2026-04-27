import { getJson, postJson } from '@/services/http';
import type { WorkspaceRecord, WorkspaceValidationResult } from '@/types/workspaces';

export function validateWorkspaceAccessKey(accessKey: string) {
  return getJson<WorkspaceValidationResult>(`/v1/workspaces/validate-key/${encodeURIComponent(accessKey)}`);
}

export function createWorkspace(body: { name: string; accessKey: string }) {
  return postJson<WorkspaceRecord, { name: string; accessKey: string }>('/v1/workspaces', body);
}
