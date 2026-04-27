export type SessionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface SessionRound {
  id: string;
  sessionId: string;
  question: string;
  referenceAnswer: string | null;
  userAnswer: string | null;
  feedback: string | null;
  score: number | null;
  followUpQuestion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSession {
  id: string;
  workspaceId: string;
  diagnosisJobId: string | null;
  title: string;
  status: SessionStatus;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
  rounds: SessionRound[];
}

export interface InterviewSessionListItem {
  id: string;
  workspaceId: string;
  diagnosisJobId: string | null;
  title: string;
  status: SessionStatus;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    rounds: number;
  };
}

export type SessionReadinessLevel = 'READY' | 'IMPROVING' | 'RISK';

export interface SessionReviewHighlight {
  question: string;
  score: number;
  insight: string;
}

export interface SessionReviewAction {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  reason: string;
}

export interface SessionReviewReport {
  sessionId: string;
  workspaceId: string;
  title: string;
  status: SessionStatus;
  readinessLevel: SessionReadinessLevel;
  score: {
    averageScore: number | null;
    totalRounds: number;
    answeredRounds: number;
    scoredRounds: number;
  };
  diagnosis: {
    totalItems: number;
    openItems: number;
    adoptedItems: number;
    ignoredItems: number;
    manuallyEditedItems: number;
    actionedRate: number;
  };
  highlights: {
    strengths: SessionReviewHighlight[];
    risks: SessionReviewHighlight[];
  };
  nextActions: SessionReviewAction[];
  generatedAt: string;
}

export interface SessionReviewTrends {
  workspaceId: string;
  windowWeeks: number;
  byWeek: Array<{
    weekLabel: string;
    sessionCount: number;
    averageScore: number | null;
    averageAnsweredRate: number;
  }>;
  byRole: Array<{
    role: string;
    sessionCount: number;
    averageScore: number | null;
    scoreDelta: number | null;
  }>;
  generatedAt: string;
}
