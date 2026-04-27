import { getJson, patchJson, postJson } from '@/services/http';
import type {
  ModelConfigConnectionResult,
  ModelConfigModelsResult,
  ModelConfigRecord,
  ModelConfigStatus,
} from '@/types/model-configs';

export function listModelConfigs(workspaceId: string) {
  const query = new URLSearchParams({ workspaceId }).toString();
  return getJson<ModelConfigRecord[]>(`/v1/model-configs?${query}`);
}

export function createModelConfig(body: {
  workspaceId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  status?: ModelConfigStatus;
}) {
  return postJson<ModelConfigRecord, typeof body>('/v1/model-configs', body);
}

export function updateModelConfig(
  configId: string,
  body: {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
    status?: ModelConfigStatus;
  },
) {
  return patchJson<ModelConfigRecord, typeof body>(`/v1/model-configs/${configId}`, body);
}

export function testModelConfigConnection(configId: string) {
  return postJson<ModelConfigConnectionResult>(`/v1/model-configs/${configId}/test`);
}

export function listModelConfigModels(configId: string) {
  return getJson<ModelConfigModelsResult>(`/v1/model-configs/${configId}/models`);
}

export function testDirectModelConnection(body: { baseUrl: string; apiKey: string; model?: string }) {
  return postJson<ModelConfigConnectionResult, typeof body>('/v1/model-configs/test-direct', body);
}
