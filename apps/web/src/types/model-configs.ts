export type ModelConfigStatus = 'ACTIVE' | 'DISABLED';

export interface ModelConfigRecord {
  id: string;
  workspaceId: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  defaultModel: string | null;
  status: ModelConfigStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModelConfigConnectionResult {
  ok: boolean;
  requestedModel: string | null;
  hasRequestedModel: boolean | null;
  modelCount: number;
  models: string[];
}

export interface ModelConfigModelsResult {
  configId: string;
  modelCount: number;
  models: string[];
}
