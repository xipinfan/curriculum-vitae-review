export type WorkspaceStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface WorkspaceValidationResult {
  valid: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  accessKey?: string;
  status: WorkspaceStatus;
  createdAt: string;
}
