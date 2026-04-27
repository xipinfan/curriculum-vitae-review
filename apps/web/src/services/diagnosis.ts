import { getJson, patchJson, postJson } from '@/services/http';
import type { DiagnosisItem, DiagnosisItemAction, DiagnosisJob, DiagnosisJobWithCount } from '@/types/diagnosis';

export function listDiagnosisJobs(workspaceId: string) {
  const search = new URLSearchParams({ workspaceId }).toString();
  return getJson<DiagnosisJobWithCount[]>(`/v1/diagnosis/jobs?${search}`);
}

export function getDiagnosisJob(jobId: string) {
  return getJson<DiagnosisJob>(`/v1/diagnosis/jobs/${jobId}`);
}

export function createDiagnosisJob(body: {
  workspaceId: string;
  resumeDocumentId?: string;
  targetRole?: string;
  targetLevel?: string;
  techStack?: string;
  businessDomain?: string;
}) {
  return postJson<DiagnosisJob, typeof body>('/v1/diagnosis/jobs', body);
}

export function startDiagnosisJob(jobId: string) {
  return postJson<{ started: boolean; reason?: string }>(`/v1/diagnosis/jobs/${jobId}/start`);
}

export function applyDiagnosisItemAction(
  jobId: string,
  itemId: string,
  body: { action: DiagnosisItemAction; userNote?: string; editedContent?: string },
) {
  return patchJson<DiagnosisItem>(`/v1/diagnosis/jobs/${jobId}/items/${itemId}/action`, body);
}
