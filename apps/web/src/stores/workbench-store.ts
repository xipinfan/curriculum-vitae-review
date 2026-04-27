import { create } from 'zustand';
import type { DiagnosisItem, DiagnosisJob, DiagnosisJobWithCount } from '@/types/diagnosis';
import type { ConfirmedResumeIntake } from '@/types/resume';
import type {
  InterviewSession,
  InterviewSessionListItem,
  SessionReviewReport,
  SessionReviewTrends,
  SessionRound,
} from '@/types/sessions';

export type ModuleKey = 'diagnosis' | 'optimize' | 'qa' | 'review';

export type BattlePackStepKey = 'import' | 'parse' | 'createJob' | 'runDiagnosis' | 'createSession' | 'generateQuestions';
type BattlePackStepStatus = 'wait' | 'process' | 'finish' | 'error';

const battlePackSteps = [
  { key: 'import' as const, title: '导入简历' },
  { key: 'parse' as const, title: '结构化解析' },
  { key: 'createJob' as const, title: '创建诊断任务' },
  { key: 'runDiagnosis' as const, title: '执行诊断分析' },
  { key: 'createSession' as const, title: '创建问答会话' },
  { key: 'generateQuestions' as const, title: '生成追问题库' },
];

function createInitialBattlePackStepState(): Record<BattlePackStepKey, BattlePackStepStatus> {
  return battlePackSteps.reduce(
    (accumulator, step) => {
      accumulator[step.key] = 'wait';
      return accumulator;
    },
    {} as Record<BattlePackStepKey, BattlePackStepStatus>,
  );
}

type WorkbenchState = {
  selectedModule: ModuleKey;
  healthText: string;
  workspaceId: string;
  workspaceName: string;
  jobId: string;
  jobs: DiagnosisJobWithCount[];
  currentJob: DiagnosisJob | null;
  jobsLoading: boolean;
  jobLoading: boolean;
  selectedDiagnosisItemId: string;
  actionLoadingByItem: Record<string, boolean>;
  manualDrafts: Record<string, string>;
  selectedOptimizeItemId: string;
  sessionTitle: string;
  sessionId: string;
  sessions: InterviewSessionListItem[];
  currentSession: InterviewSession | null;
  sessionsLoading: boolean;
  sessionLoading: boolean;
  selectedQaRoundId: string;
  questionGenerating: boolean;
  sessionProgress: number;
  answerDrafts: Record<string, string>;
  answerLoadingByRound: Record<string, boolean>;
  reviewLoading: boolean;
  reviewReport: SessionReviewReport | null;
  reviewTrends: SessionReviewTrends | null;
  reviewTrendsLoading: boolean;
  trendWeeks: number;
  resumeSourceType: 'TEXT' | 'MARKDOWN';
  resumeContent: string;
  targetRole: string;
  targetLevel: string;
  targetTechStack: string;
  targetBusinessDomain: string;
  battlePackLoading: boolean;
  battlePackStepState: Record<BattlePackStepKey, BattlePackStepStatus>;
  battlePackCurrentStep: number;
  battlePackError: string;
  resumeId: string;
  assistantDraft: string;
  bootstrappedWorkspaceIdRef: string;

  setSelectedModule: (module: ModuleKey) => void;
  setHealthText: (text: string) => void;
  setWorkspaceId: (id: string) => void;
  setWorkspaceName: (name: string) => void;
  setJobId: (id: string) => void;
  setJobs: (jobs: DiagnosisJobWithCount[]) => void;
  setCurrentJob: (job: DiagnosisJob | null) => void;
  setJobsLoading: (loading: boolean) => void;
  setJobLoading: (loading: boolean) => void;
  setSelectedDiagnosisItemId: (id: string) => void;
  setActionLoadingByItem: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setManualDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  setSelectedOptimizeItemId: (id: string) => void;
  setSessionTitle: (title: string) => void;
  setSessionId: (id: string) => void;
  setSessions: (sessions: InterviewSessionListItem[]) => void;
  setCurrentSession: (session: InterviewSession | null) => void;
  setSessionsLoading: (loading: boolean) => void;
  setSessionLoading: (loading: boolean) => void;
  setSelectedQaRoundId: (id: string) => void;
  setQuestionGenerating: (generating: boolean) => void;
  setSessionProgress: (progress: number) => void;
  setAnswerDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  setAnswerLoadingByRound: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setReviewLoading: (loading: boolean) => void;
  setReviewReport: (report: SessionReviewReport | null) => void;
  setReviewTrends: (trends: SessionReviewTrends | null) => void;
  setReviewTrendsLoading: (loading: boolean) => void;
  setTrendWeeks: (weeks: number) => void;
  setResumeSourceType: (type: 'TEXT' | 'MARKDOWN') => void;
  setResumeContent: (content: string) => void;
  setTargetRole: (role: string) => void;
  setTargetLevel: (level: string) => void;
  setTargetTechStack: (stack: string) => void;
  setTargetBusinessDomain: (domain: string) => void;
  setBattlePackLoading: (loading: boolean) => void;
  setBattlePackStepState: (updater: (prev: Record<BattlePackStepKey, BattlePackStepStatus>) => Record<BattlePackStepKey, BattlePackStepStatus>) => void;
  setBattlePackCurrentStep: (step: number) => void;
  setBattlePackError: (error: string) => void;
  setResumeId: (id: string) => void;
  setAssistantDraft: (draft: string) => void;
  setBootstrappedWorkspaceIdRef: (ref: string) => void;
  applyDiagnosisItemUpdate: (updated: DiagnosisItem) => void;
  resetBattlePack: () => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  selectedModule: 'diagnosis',
  healthText: '连接中...',
  workspaceId: '',
  workspaceName: '',
  jobId: '',
  jobs: [],
  currentJob: null,
  jobsLoading: false,
  jobLoading: false,
  selectedDiagnosisItemId: '',
  actionLoadingByItem: {},
  manualDrafts: {},
  selectedOptimizeItemId: '',
  sessionTitle: '模拟面试训练',
  sessionId: '',
  sessions: [],
  currentSession: null,
  sessionsLoading: false,
  sessionLoading: false,
  selectedQaRoundId: '',
  questionGenerating: false,
  sessionProgress: 0,
  answerDrafts: {},
  answerLoadingByRound: {},
  reviewLoading: false,
  reviewReport: null,
  reviewTrends: null,
  reviewTrendsLoading: false,
  trendWeeks: 8,
  resumeSourceType: 'MARKDOWN',
  resumeContent: '',
  targetRole: '后端开发工程师',
  targetLevel: '中高级',
  targetTechStack: 'NestJS, TypeScript, PostgreSQL',
  targetBusinessDomain: 'SaaS',
  battlePackLoading: false,
  battlePackStepState: createInitialBattlePackStepState(),
  battlePackCurrentStep: 0,
  battlePackError: '',
  resumeId: '',
  assistantDraft: '',
  bootstrappedWorkspaceIdRef: '',

  setSelectedModule: (module) => set({ selectedModule: module }),
  setHealthText: (text) => set({ healthText: text }),
  setWorkspaceId: (id) => set({ workspaceId: id }),
  setWorkspaceName: (name) => set({ workspaceName: name }),
  setJobId: (id) => set({ jobId: id }),
  setJobs: (jobs) => set({ jobs }),
  setCurrentJob: (job) => set({ currentJob: job }),
  setJobsLoading: (loading) => set({ jobsLoading: loading }),
  setJobLoading: (loading) => set({ jobLoading: loading }),
  setSelectedDiagnosisItemId: (id) => set({ selectedDiagnosisItemId: id }),
  setActionLoadingByItem: (updater) => set((prev) => ({ actionLoadingByItem: updater(prev.actionLoadingByItem) })),
  setManualDrafts: (updater) => set((prev) => ({ manualDrafts: updater(prev.manualDrafts) })),
  setSelectedOptimizeItemId: (id) => set({ selectedOptimizeItemId: id }),
  setSessionTitle: (title) => set({ sessionTitle: title }),
  setSessionId: (id) => set({ sessionId: id }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setSessionsLoading: (loading) => set({ sessionsLoading: loading }),
  setSessionLoading: (loading) => set({ sessionLoading: loading }),
  setSelectedQaRoundId: (id) => set({ selectedQaRoundId: id }),
  setQuestionGenerating: (generating) => set({ questionGenerating: generating }),
  setSessionProgress: (progress) => set({ sessionProgress: progress }),
  setAnswerDrafts: (updater) => set((prev) => ({ answerDrafts: updater(prev.answerDrafts) })),
  setAnswerLoadingByRound: (updater) => set((prev) => ({ answerLoadingByRound: updater(prev.answerLoadingByRound) })),
  setReviewLoading: (loading) => set({ reviewLoading: loading }),
  setReviewReport: (report) => set({ reviewReport: report }),
  setReviewTrends: (trends) => set({ reviewTrends: trends }),
  setReviewTrendsLoading: (loading) => set({ reviewTrendsLoading: loading }),
  setTrendWeeks: (weeks) => set({ trendWeeks: weeks }),
  setResumeSourceType: (type) => set({ resumeSourceType: type }),
  setResumeContent: (content) => set({ resumeContent: content }),
  setTargetRole: (role) => set({ targetRole: role }),
  setTargetLevel: (level) => set({ targetLevel: level }),
  setTargetTechStack: (stack) => set({ targetTechStack: stack }),
  setTargetBusinessDomain: (domain) => set({ targetBusinessDomain: domain }),
  setBattlePackLoading: (loading) => set({ battlePackLoading: loading }),
  setBattlePackStepState: (updater) => set((prev) => ({ battlePackStepState: updater(prev.battlePackStepState) })),
  setBattlePackCurrentStep: (step) => set({ battlePackCurrentStep: step }),
  setBattlePackError: (error) => set({ battlePackError: error }),
  setResumeId: (id) => set({ resumeId: id }),
  setAssistantDraft: (draft) => set({ assistantDraft: draft }),
  setBootstrappedWorkspaceIdRef: (ref) => set({ bootstrappedWorkspaceIdRef: ref }),
  applyDiagnosisItemUpdate: (updated) =>
    set((prev) => ({
      currentJob: prev.currentJob
        ? {
            ...prev.currentJob,
            items: (prev.currentJob.items ?? []).map((entry) =>
              entry.id === updated.id ? updated : entry,
            ),
          }
        : null,
    })),
  resetBattlePack: () =>
    set({
      battlePackLoading: false,
      battlePackError: '',
      battlePackStepState: createInitialBattlePackStepState(),
      battlePackCurrentStep: 0,
    }),
}));
