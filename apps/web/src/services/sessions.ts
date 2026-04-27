import { getJson, patchJson, postJson } from '@/services/http';
import type {
  InterviewSession,
  InterviewSessionListItem,
  SessionReviewReport,
  SessionReviewTrends,
  SessionRound,
} from '@/types/sessions';

export function listSessions(workspaceId: string) {
  const query = new URLSearchParams({ workspaceId }).toString();
  return getJson<InterviewSessionListItem[]>(`/v1/sessions?${query}`);
}

export function createSession(body: { workspaceId: string; title: string; diagnosisJobId?: string }) {
  return postJson<InterviewSession, { workspaceId: string; title: string; diagnosisJobId?: string }>('/v1/sessions', body);
}

export function getSession(sessionId: string) {
  return getJson<InterviewSession>(`/v1/sessions/${sessionId}`);
}

export function generateSessionQuestions(sessionId: string, body?: { count?: number; focus?: string }) {
  return postJson<{ sessionId: string; generatedCount: number; rounds: Array<{ id: string; question: string; referenceAnswer: string | null }> }, { count?: number; focus?: string }>(
    `/v1/sessions/${sessionId}/generate-questions`,
    body,
  );
}

export function submitSessionAnswer(sessionId: string, roundId: string, body: { userAnswer: string; createFollowUp?: boolean }) {
  return patchJson<{
    updatedRound: SessionRound;
    followUpRound: { id: string; question: string } | null;
    session: { id: string; overallScore: number | null; status: string };
  }>(`/v1/sessions/${sessionId}/rounds/${roundId}/answer`, body);
}

export function getSessionProgress(sessionId: string) {
  return getJson<{
    sessionId: string;
    totalRounds: number;
    answeredRounds: number;
    progressPercent: number;
    averageScore: number | null;
  }>(`/v1/sessions/${sessionId}/progress`);
}

export function getSessionReview(sessionId: string) {
  return getJson<SessionReviewReport>(`/v1/sessions/${sessionId}/review`);
}

export function getSessionReviewTrends(workspaceId: string, weeks?: number) {
  const query = new URLSearchParams({
    workspaceId,
    ...(typeof weeks === 'number' ? { weeks: String(weeks) } : {}),
  }).toString();
  return getJson<SessionReviewTrends>(`/v1/sessions/review-trends?${query}`);
}
