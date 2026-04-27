import { getJson, postJson } from '@/services/http';
import type { ImportedResumeRecord, ParsedResumeResult, StructuredResume } from '@/types/resume';

export function importResume(body: {
  workspaceId: string;
  sourceType: 'TEXT' | 'MARKDOWN';
  content: string;
}) {
  return postJson<ImportedResumeRecord, typeof body>('/v1/resumes/import', body);
}

export function parseResume(resumeId: string, body?: { force?: boolean }) {
  return postJson<ParsedResumeResult, { force?: boolean }>(`/v1/resumes/${resumeId}/parse`, body);
}

export function getStructuredResume(resumeId: string) {
  return getJson<{
    id: string;
    parserVersion: string | null;
    parsedAt: string | null;
    parsedData: StructuredResume | null;
  }>(`/v1/resumes/${resumeId}/structured`);
}
