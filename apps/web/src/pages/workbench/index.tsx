import { CheckCircleOutlined, EditOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Input,
  Segmented,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModelConfigModal } from '@/components/model-config-modal';
import { WorkspaceAiPanel, type WorkspaceAiConversationItem, type WorkspaceAiMessage } from '@/components/workspace-ai-panel';
import { useWorkspaceModelConfig } from '@/hooks/use-workspace-model-config';
import {
  applyDiagnosisItemAction,
  createDiagnosisJob,
  getDiagnosisJob,
  listDiagnosisJobs,
  startDiagnosisJob,
} from '@/services/diagnosis';
import { importResume, parseResume } from '@/services/resumes';
import {
  createSession,
  generateSessionQuestions,
  getSession,
  getSessionProgress,
  getSessionReview,
  getSessionReviewTrends,
  listSessions,
  submitSessionAnswer,
} from '@/services/sessions';
import { fetchHealth } from '@/services/system';
import type { DiagnosisItem, DiagnosisJob, DiagnosisJobWithCount } from '@/types/diagnosis';
import type { ConfirmedResumeIntake } from '@/types/resume';
import type {
  InterviewSession,
  InterviewSessionListItem,
  SessionReviewReport,
  SessionReviewTrends,
  SessionRound,
} from '@/types/sessions';
import './styles.less';

const { Title, Text } = Typography;

const modules = [
  { value: 'diagnosis', label: '简历诊断', icon: <SearchOutlined /> },
  { value: 'optimize', label: '简历优化', icon: <EditOutlined /> },
  { value: 'qa', label: '问答练习', icon: <MessageOutlined /> },
  { value: 'review', label: '复盘清单', icon: <CheckCircleOutlined /> },
] as const;

type ModuleKey = (typeof modules)[number]['value'];

type BattlePackStepKey = 'import' | 'parse' | 'createJob' | 'runDiagnosis' | 'createSession' | 'generateQuestions';

const battlePackSteps: Array<{ key: BattlePackStepKey; title: string }> = [
  { key: 'import', title: '导入简历' },
  { key: 'parse', title: '结构化解析' },
  { key: 'createJob', title: '创建诊断任务' },
  { key: 'runDiagnosis', title: '执行诊断分析' },
  { key: 'createSession', title: '创建问答会话' },
  { key: 'generateQuestions', title: '生成追问题库' },
];

type BattlePackStepStatus = 'wait' | 'process' | 'finish' | 'error';

function createInitialBattlePackStepState() {
  return battlePackSteps.reduce(
    (accumulator, step) => {
      accumulator[step.key] = 'wait';
      return accumulator;
    },
    {} as Record<BattlePackStepKey, BattlePackStepStatus>,
  );
}

export function WorkbenchPage() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('diagnosis');
  const [healthText, setHealthText] = useState('连接中...');
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobs, setJobs] = useState<DiagnosisJobWithCount[]>([]);
  const [currentJob, setCurrentJob] = useState<DiagnosisJob | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(false);
  const [selectedDiagnosisItemId, setSelectedDiagnosisItemId] = useState('');
  const [actionLoadingByItem, setActionLoadingByItem] = useState<Record<string, boolean>>({});
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [selectedOptimizeItemId, setSelectedOptimizeItemId] = useState('');
  const [sessionTitle, setSessionTitle] = useState('模拟面试训练');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<InterviewSessionListItem[]>([]);
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedQaRoundId, setSelectedQaRoundId] = useState('');
  const [questionGenerating, setQuestionGenerating] = useState(false);
  const [sessionProgress, setSessionProgress] = useState<number>(0);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answerLoadingByRound, setAnswerLoadingByRound] = useState<Record<string, boolean>>({});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewReport, setReviewReport] = useState<SessionReviewReport | null>(null);
  const [reviewTrendsLoading, setReviewTrendsLoading] = useState(false);
  const [reviewTrends, setReviewTrends] = useState<SessionReviewTrends | null>(null);
  const [trendWeeks, setTrendWeeks] = useState<number>(8);
  const [resumeSourceType, setResumeSourceType] = useState<'TEXT' | 'MARKDOWN'>('MARKDOWN');
  const [resumeContent, setResumeContent] = useState('');
  const [targetRole, setTargetRole] = useState('后端开发工程师');
  const [targetLevel, setTargetLevel] = useState('中高级');
  const [targetTechStack, setTargetTechStack] = useState('NestJS, TypeScript, PostgreSQL');
  const [targetBusinessDomain, setTargetBusinessDomain] = useState('SaaS');
  const [battlePackLoading, setBattlePackLoading] = useState(false);
  const [battlePackStepState, setBattlePackStepState] = useState<Record<BattlePackStepKey, BattlePackStepStatus>>(
    createInitialBattlePackStepState,
  );
  const [battlePackCurrentStep, setBattlePackCurrentStep] = useState(0);
  const [battlePackError, setBattlePackError] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState('');
  const bootstrappedWorkspaceIdRef = useRef('');
  const { activeConfig: activeModelConfig, reload: reloadModelConfig } = useWorkspaceModelConfig(workspaceId);

  useEffect(() => {
    const savedWorkspace = localStorage.getItem('cv-review.workspaceId');
    if (savedWorkspace) {
      setWorkspaceId(savedWorkspace);
    }
    const savedWorkspaceName = localStorage.getItem('cv-review.workspaceName');
    if (savedWorkspaceName) {
      setWorkspaceName(savedWorkspaceName);
    }

    const intakeRaw = localStorage.getItem('cv-review.intake');
    if (!intakeRaw) {
      return;
    }
    try {
      const intake = JSON.parse(intakeRaw) as Partial<ConfirmedResumeIntake>;
      if (intake.resumeContent?.trim()) {
        setResumeContent(intake.resumeContent);
      }
      if (intake.role?.trim()) {
        setTargetRole(intake.role);
      }
      if (intake.techStack?.trim()) {
        setTargetTechStack(intake.techStack);
      }
      if (intake.level?.trim()) {
        setTargetLevel(intake.level);
      }
      if (intake.domain?.trim()) {
        setTargetBusinessDomain(intake.domain);
      }
      if (intake.resumeId?.trim()) {
        setResumeId(intake.resumeId);
      }
    } catch {
      // Ignore invalid local cache from previous versions.
    }
  }, []);

  function ensureModelConfigured() {
    if (activeModelConfig) {
      return true;
    }
    messageApi.warning('请先配置模型 / Base URL / API Key，避免继续使用默认模型');
    return false;
  }

  useEffect(() => {
    if (!workspaceId.trim() || !activeModelConfig || !resumeId.trim()) {
      return;
    }
    if (localStorage.getItem('cv-review.autostartBattlePack') !== '1') {
      return;
    }
    if (battlePackLoading || currentJob || jobId) {
      localStorage.removeItem('cv-review.autostartBattlePack');
      return;
    }

    localStorage.removeItem('cv-review.autostartBattlePack');
    void handleGenerateBattlePack();
  }, [activeModelConfig, battlePackLoading, currentJob, jobId, resumeId, workspaceId]);

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealthText(`API 正常 (${data.timestamp})`);
      })
      .catch(() => setHealthText('API 未连接，请先启动后端服务'));
  }, []);

  useEffect(() => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }
    if (bootstrappedWorkspaceIdRef.current === normalizedWorkspaceId) {
      return;
    }

    bootstrappedWorkspaceIdRef.current = normalizedWorkspaceId;
    void loadJobs();
    void loadSessions();
  }, [workspaceId]);

  useEffect(() => {
    if (!currentJob || currentJob.status !== 'RUNNING') {
      return;
    }

    const timer = window.setInterval(() => {
      void loadJob(currentJob.id, { silent: true });
    }, 2500);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentJob]);

  async function loadJobs() {
    if (!workspaceId.trim()) {
      messageApi.warning('请先输入 workspaceId');
      return;
    }
    setJobsLoading(true);
    try {
      const fetched = await listDiagnosisJobs(workspaceId.trim());
      setJobs(fetched);
      if (!jobId && fetched.length > 0) {
        setJobId(fetched[0].id);
        await loadJob(fetched[0].id, { silent: true });
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '加载任务列表失败');
    } finally {
      setJobsLoading(false);
    }
  }

  async function loadJob(targetJobId = jobId, options?: { silent?: boolean }) {
    const normalized = targetJobId.trim();
    if (!normalized) {
      if (!options?.silent) {
        messageApi.warning('请先输入 diagnosis jobId');
      }
      return;
    }

    setJobLoading(true);
    try {
      const job = await getDiagnosisJob(normalized);
      setCurrentJob(job);
      setJobId(job.id);
    } catch (error) {
      if (!options?.silent) {
        messageApi.error(error instanceof Error ? error.message : '加载任务失败');
      }
    } finally {
      setJobLoading(false);
    }
  }

  async function handleStartDiagnosis() {
    if (!ensureModelConfigured()) {
      return;
    }
    const normalized = jobId.trim();
    if (!normalized) {
      messageApi.warning('请先输入 diagnosis jobId');
      return;
    }

    try {
      const result = await startDiagnosisJob(normalized);
      if (result.started) {
        messageApi.success('诊断任务已启动');
      } else {
        messageApi.info(`任务未启动：${result.reason}`);
      }
      await loadJob(normalized, { silent: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '启动任务失败');
    }
  }

  async function handleApplyAction(item: DiagnosisItem, action: 'ADOPT' | 'IGNORE' | 'MANUAL_EDIT') {
    if (!currentJob) {
      return;
    }

    const fallbackEditedContent = item.suggestion?.trim() || item.description?.trim();
    const editedContent = action === 'MANUAL_EDIT' ? manualDrafts[item.id]?.trim() || fallbackEditedContent : undefined;
    if (action === 'MANUAL_EDIT' && !editedContent) {
      messageApi.warning('手动编辑时请填写改写内容');
      return;
    }

    setActionLoadingByItem((prev) => ({ ...prev, [item.id]: true }));
    try {
      const updated = await applyDiagnosisItemAction(currentJob.id, item.id, {
        action,
        editedContent,
      });
      setCurrentJob((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          items: (prev.items ?? []).map((entry) => (entry.id === updated.id ? updated : entry)),
        };
      });
      messageApi.success('处理成功');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '处理失败');
    } finally {
      setActionLoadingByItem((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function loadSessions() {
    if (!workspaceId.trim()) {
      messageApi.warning('请先输入 workspaceId');
      return;
    }
    setSessionsLoading(true);
    try {
      const data = await listSessions(workspaceId.trim());
      setSessions(data);
      if (!sessionId && data.length > 0) {
        setSessionId(data[0].id);
        await loadSession(data[0].id, { silent: true });
      }
      if (selectedModule === 'review') {
        await loadReviewTrends(workspaceId.trim(), trendWeeks);
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '加载会话列表失败');
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!workspaceId.trim()) {
      messageApi.warning('请先输入 workspaceId');
      return;
    }
    if (!sessionTitle.trim()) {
      messageApi.warning('请先输入会话标题');
      return;
    }

    try {
      const created = await createSession({
        workspaceId: workspaceId.trim(),
        title: sessionTitle.trim(),
      });
      messageApi.success('问答会话已创建');
      setSessionId(created.id);
      await loadSessions();
      await loadSession(created.id, { silent: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '创建会话失败');
    }
  }

  async function loadSession(targetSessionId = sessionId, options?: { silent?: boolean }) {
    const normalized = targetSessionId.trim();
    if (!normalized) {
      if (!options?.silent) {
        messageApi.warning('请先输入 sessionId');
      }
      return;
    }
    setSessionLoading(true);
    try {
      const session = await getSession(normalized);
      setCurrentSession(session);
      setSessionId(session.id);

      const progress = await getSessionProgress(normalized);
      setSessionProgress(progress.progressPercent);
    } catch (error) {
      if (!options?.silent) {
        messageApi.error(error instanceof Error ? error.message : '加载会话失败');
      }
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleGenerateQuestions() {
    if (!ensureModelConfigured()) {
      return;
    }
    const normalized = sessionId.trim();
    if (!normalized) {
      messageApi.warning('请先输入 sessionId');
      return;
    }
    setQuestionGenerating(true);
    try {
      const generated = await generateSessionQuestions(normalized, { count: 4 });
      messageApi.success(`已生成 ${generated.generatedCount} 道问题`);
      await loadSession(normalized, { silent: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '生成问题失败');
    } finally {
      setQuestionGenerating(false);
    }
  }

  async function handleSubmitAnswer(round: SessionRound) {
    const draft = answerDrafts[round.id]?.trim();
    if (!currentSession) {
      return;
    }
    if (!draft) {
      messageApi.warning('请先输入回答内容');
      return;
    }
    setAnswerLoadingByRound((prev) => ({ ...prev, [round.id]: true }));
    try {
      await submitSessionAnswer(currentSession.id, round.id, {
        userAnswer: draft,
        createFollowUp: true,
      });
      messageApi.success('回答已提交并完成批改');
      await loadSession(currentSession.id, { silent: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '提交回答失败');
    } finally {
      setAnswerLoadingByRound((prev) => ({ ...prev, [round.id]: false }));
    }
  }

  async function loadSessionReview(targetSessionId = sessionId) {
    if (!ensureModelConfigured()) {
      return;
    }
    const normalized = targetSessionId.trim();
    if (!normalized) {
      messageApi.warning('请先输入 sessionId');
      return;
    }

    setReviewLoading(true);
    try {
      const report = await getSessionReview(normalized);
      setReviewReport(report);
      setSessionId(report.sessionId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '加载复盘失败');
    } finally {
      setReviewLoading(false);
    }
  }

  async function loadReviewTrends(targetWorkspaceId = workspaceId, targetWeeks = trendWeeks) {
    const normalizedWorkspaceId = targetWorkspaceId.trim();
    if (!normalizedWorkspaceId) {
      messageApi.warning('请先输入 workspaceId');
      return;
    }

    setReviewTrendsLoading(true);
    try {
      const trends = await getSessionReviewTrends(normalizedWorkspaceId, targetWeeks);
      setReviewTrends(trends);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '加载趋势失败');
    } finally {
      setReviewTrendsLoading(false);
    }
  }

  async function waitDiagnosisCompleted(targetJobId: string) {
    const maxRetries = 30;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      const job = await getDiagnosisJob(targetJobId);
      setCurrentJob(job);
      if (job.status === 'COMPLETED') {
        return job;
      }
      if (job.status === 'FAILED') {
        throw new Error(job.errorMessage ?? '诊断任务失败');
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    throw new Error('诊断执行超时，请稍后手动刷新');
  }

  async function handleGenerateBattlePack() {
    if (!workspaceId.trim()) {
      messageApi.warning('请先输入 workspaceId');
      return;
    }
    if (!ensureModelConfigured()) {
      return;
    }
    if (!resumeContent.trim() || resumeContent.trim().length < 20) {
      messageApi.warning('请先输入简历内容（至少 20 字）');
      return;
    }

    setBattlePackLoading(true);
    setBattlePackError('');
    setBattlePackStepState(createInitialBattlePackStepState());
    let activeStep: BattlePackStepKey | null = null;
    const beginStep = (stepKey: BattlePackStepKey, loadingText: string) => {
      activeStep = stepKey;
      setBattlePackCurrentStep(Math.max(0, battlePackSteps.findIndex((step) => step.key === stepKey)));
      setBattlePackStepState((prev) => ({ ...prev, [stepKey]: 'process' }));
      messageApi.loading({ content: loadingText, key: 'battle-pack' });
    };
    const finishStep = (stepKey: BattlePackStepKey) => {
      setBattlePackStepState((prev) => ({ ...prev, [stepKey]: 'finish' }));
    };

    try {
      let resolvedResumeId = resumeId.trim();
      if (resolvedResumeId) {
        beginStep('import', '1/6 复用已导入简历...');
        finishStep('import');

        beginStep('parse', '2/6 复用已解析简历...');
        finishStep('parse');
      } else {
        beginStep('import', '1/6 正在导入简历...');
        const resume = await importResume({
          workspaceId: workspaceId.trim(),
          sourceType: resumeSourceType,
          content: resumeContent.trim(),
        });
        resolvedResumeId = resume.id;
        setResumeId(resume.id);
        finishStep('import');

        beginStep('parse', '2/6 正在结构化解析简历...');
        await parseResume(resume.id, { force: true });
        finishStep('parse');
      }

      beginStep('createJob', '3/6 正在创建诊断任务...');
      const job = await createDiagnosisJob({
        workspaceId: workspaceId.trim(),
        resumeDocumentId: resolvedResumeId,
        targetRole: targetRole.trim(),
        targetLevel: targetLevel.trim(),
        techStack: targetTechStack.trim(),
        businessDomain: targetBusinessDomain.trim(),
      });
      setJobId(job.id);
      finishStep('createJob');

      beginStep('runDiagnosis', '4/6 正在执行诊断分析...');
      await startDiagnosisJob(job.id);
      const finishedJob = await waitDiagnosisCompleted(job.id);
      setCurrentJob(finishedJob);
      finishStep('runDiagnosis');

      beginStep('createSession', '5/6 正在创建问答会话...');
      const session = await createSession({
        workspaceId: workspaceId.trim(),
        diagnosisJobId: job.id,
        title: `${targetRole.trim() || '岗位'}面试作战会话`,
      });
      setSessionId(session.id);
      finishStep('createSession');

      beginStep('generateQuestions', '6/6 正在生成追问题库...');
      await generateSessionQuestions(session.id, {
        count: 5,
        focus: targetRole.trim() || '综合能力',
      });
      finishStep('generateQuestions');
      await loadSession(session.id, { silent: true });
      await loadJobs();
      await loadSessions();

      setSelectedModule('qa');
      messageApi.success({ content: '作战包已生成，已切换到问答练习模块', key: 'battle-pack' });
    } catch (error) {
      if (activeStep) {
        setBattlePackStepState((prev) => ({ ...prev, [activeStep as BattlePackStepKey]: 'error' }));
      }
      setBattlePackError(error instanceof Error ? error.message : '作战包生成失败');
      messageApi.error({
        content: error instanceof Error ? error.message : '作战包生成失败',
        key: 'battle-pack',
      });
    } finally {
      setBattlePackLoading(false);
    }
  }

  function readinessColor(level: SessionReviewReport['readinessLevel']) {
    if (level === 'READY') return 'success';
    if (level === 'IMPROVING') return 'processing';
    return 'error';
  }

  function scoreTagColor(score: number | null) {
    if (typeof score !== 'number') return 'default';
    if (score >= 85) return 'success';
    if (score >= 70) return 'processing';
    return 'error';
  }

  const qaViewModel = useMemo(() => {
    const rounds = currentSession?.rounds ?? [];
    const fallbackRound =
      rounds.find((item) => item.id === selectedQaRoundId) ??
      rounds.find((item) => !item.userAnswer?.trim()) ??
      rounds[0] ??
      null;
    const activeIndex = fallbackRound ? rounds.findIndex((item) => item.id === fallbackRound.id) : -1;
    const activeRound = activeIndex >= 0 ? rounds[activeIndex] : null;
    const queue = activeIndex >= 0 ? rounds.slice(activeIndex + 1, activeIndex + 3) : [];

    const sourceItem =
      (currentJob?.items ?? []).find((item) => item.status === 'OPEN') ??
      (currentJob?.items ?? []).find((item) => item.severity === 'HIGH') ??
      (currentJob?.items ?? [])[0];

    return {
      sourceItem,
      sourceTitle: sourceItem?.title ?? '来源诊断项',
      sourceText: sourceItem?.description ?? '请先加载诊断任务，系统会展示当前追问来源。',
      sourceSuggestion: sourceItem?.suggestion ?? '优先补充量化指标、技术权衡和结果验证方式。',
      activeRound,
      queue,
    };
  }, [currentJob, currentSession, selectedQaRoundId]);

  const diagnosisViewModel = useMemo(() => {
    const statusWeight: Record<DiagnosisItem['status'], number> = {
      OPEN: 3,
      MANUALLY_EDITED: 2,
      ADOPTED: 1,
      IGNORED: 0,
    };
    const severityWeight: Record<DiagnosisItem['severity'], number> = {
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const sortedItems = [...(currentJob?.items ?? [])].sort((left, right) => {
      const statusGap = statusWeight[right.status] - statusWeight[left.status];
      if (statusGap !== 0) return statusGap;
      return severityWeight[right.severity] - severityWeight[left.severity];
    });

    const issueCount = sortedItems.length;
    const highRiskCount = sortedItems.filter((item) => item.severity === 'HIGH' && item.status === 'OPEN').length;
    const optimizableCount = sortedItems.filter((item) => item.status === 'OPEN' && Boolean(item.suggestion)).length;
    const followUpCount = (currentSession?.rounds ?? []).length || issueCount * 2;
    const answeredRounds = (currentSession?.rounds ?? []).filter((round) => round.userAnswer?.trim()).length;
    const weightedTotal = Math.max(1, issueCount + (currentSession?.rounds ?? []).length);
    const progressPercent = Math.max(
      0,
      Math.min(100, Math.round(((issueCount - highRiskCount) + answeredRounds) / weightedTotal * 100)),
    );

    return {
      sortedItems,
      primaryIssue: sortedItems[0] ?? null,
      secondaryIssues: sortedItems.slice(1),
      issueCount,
      highRiskCount,
      optimizableCount,
      followUpCount,
      pendingRiskCount: sortedItems.filter((item) => item.status === 'OPEN').length,
      pendingAnswerCount: Math.max(0, (currentSession?.rounds ?? []).length - answeredRounds),
      progressPercent,
    };
  }, [currentJob, currentSession]);

  function severityBadgeClass(level: DiagnosisItem['severity']) {
    if (level === 'HIGH') return 'is-high';
    if (level === 'MEDIUM') return 'is-medium';
    return 'is-practice';
  }

  function severityBadgeText(level: DiagnosisItem['severity']) {
    if (level === 'HIGH') return '高风险';
    if (level === 'MEDIUM') return '中风险';
    return '建议练习';
  }

  const optimizeItems = diagnosisViewModel.sortedItems;
  const activeDiagnosisItem =
    diagnosisViewModel.sortedItems.find((item) => item.id === selectedDiagnosisItemId) ??
    diagnosisViewModel.primaryIssue ??
    null;
  const activeOptimizeItem =
    optimizeItems.find((item) => item.id === selectedOptimizeItemId) ??
    optimizeItems.find((item) => item.status === 'OPEN') ??
    optimizeItems[0] ??
    null;
  const qaRounds = currentSession?.rounds ?? [];
  const activeQaRound = qaViewModel.activeRound;
  const qaFixSuggestions = useMemo(() => {
    const candidates = [
      activeQaRound?.feedback?.trim(),
      activeQaRound?.followUpQuestion?.trim() ? `继续追问：${activeQaRound.followUpQuestion.trim()}` : '',
      qaViewModel.sourceSuggestion?.trim(),
    ].filter((item): item is string => Boolean(item));

    return Array.from(new Set(candidates)).slice(0, 3);
  }, [activeQaRound, qaViewModel.sourceSuggestion]);

  const reviewPreparedCount =
    reviewReport?.highlights.strengths.length ??
    (currentSession?.rounds ?? []).filter((round) => typeof round.score === 'number' && round.score >= 80).length;
  const reviewWeakCount = reviewReport?.highlights.risks.length ?? diagnosisViewModel.pendingRiskCount;
  const reviewBackToResumeCount = reviewReport?.diagnosis.openItems ?? diagnosisViewModel.highRiskCount;

  const reviewTasks = reviewReport
    ? [
        ...reviewReport.highlights.strengths.slice(0, 2).map((item) => ({
          status: 'done' as const,
          text: item.question,
        })),
        ...reviewReport.highlights.risks.slice(0, 2).map((item) => ({
          status: 'risk' as const,
          text: item.question,
        })),
        ...reviewReport.nextActions.slice(0, 2).map((item) => ({
          status: 'todo' as const,
          text: item.action,
        })),
      ].slice(0, 6)
    : [
        { status: 'done' as const, text: '订单系统指标已经补充到简历' },
        { status: 'risk' as const, text: '稳定性追问回答缺少压测证据' },
        { status: 'todo' as const, text: '准备支付回调幂等性的 STAR 回答' },
      ];

  const reviewPlanText =
    reviewReport && reviewReport.nextActions.length > 0
      ? reviewReport.nextActions
          .slice(0, 2)
          .map((item) => item.action)
          .join('；')
      : '先回到简历优化页处理高风险描述，再进入问答练习页完成关键追问。';

  useEffect(() => {
    if (diagnosisViewModel.sortedItems.length === 0) {
      if (selectedDiagnosisItemId) {
        setSelectedDiagnosisItemId('');
      }
      return;
    }
    if (!selectedDiagnosisItemId || !diagnosisViewModel.sortedItems.some((item) => item.id === selectedDiagnosisItemId)) {
      setSelectedDiagnosisItemId(diagnosisViewModel.sortedItems[0].id);
    }
  }, [diagnosisViewModel.sortedItems, selectedDiagnosisItemId]);

  useEffect(() => {
    if (optimizeItems.length === 0) {
      if (selectedOptimizeItemId) {
        setSelectedOptimizeItemId('');
      }
      return;
    }
    if (!selectedOptimizeItemId || !optimizeItems.some((item) => item.id === selectedOptimizeItemId)) {
      setSelectedOptimizeItemId(optimizeItems[0].id);
    }
  }, [optimizeItems, selectedOptimizeItemId]);

  useEffect(() => {
    if (qaRounds.length === 0) {
      if (selectedQaRoundId) {
        setSelectedQaRoundId('');
      }
      return;
    }

    if (!selectedQaRoundId || !qaRounds.some((round) => round.id === selectedQaRoundId)) {
      const fallbackRound = qaRounds.find((round) => !round.userAnswer?.trim()) ?? qaRounds[0];
      setSelectedQaRoundId(fallbackRound.id);
    }
  }, [qaRounds, selectedQaRoundId]);

  const headerConfig: Record<ModuleKey, { title: string; subtitle: string; actionText: string }> = {
    diagnosis: {
      title: '简历诊断',
      subtitle: '本页只处理简历诊断问题；优化、问答和复盘分别进入独立模块。',
      actionText: '重新诊断',
    },
    optimize: {
      title: '简历优化',
      subtitle: '逐条处理 AI 诊断项，对比原文和改写建议，保存可回退的修改记录。',
      actionText: '生成改写',
    },
    qa: {
      title: '问答练习',
      subtitle: '基于简历中的项目、技术点和风险项生成追问，保存回答草稿和 AI 批改结果。',
      actionText: '生成追问',
    },
    review: {
      title: '复盘清单',
      subtitle: '汇总简历修改、问答通过情况和仍需补强的薄弱点，形成下一轮准备计划。',
      actionText: '生成复盘',
    },
  };

  const currentHeader = headerConfig[selectedModule];

  const moduleActionLoading =
    selectedModule === 'diagnosis'
      ? jobLoading
      : selectedModule === 'optimize'
        ? Boolean(activeOptimizeItem && actionLoadingByItem[activeOptimizeItem.id])
        : selectedModule === 'qa'
          ? questionGenerating
          : reviewLoading;

  const currentConversationKey =
    selectedModule === 'diagnosis'
      ? activeDiagnosisItem?.id
      : selectedModule === 'optimize'
        ? activeOptimizeItem?.id
        : selectedModule === 'qa'
          ? activeQaRound?.id
          : 'review-overview';

  const moduleConversations = useMemo<WorkspaceAiConversationItem[]>(() => {
    if (selectedModule === 'diagnosis') {
      return diagnosisViewModel.sortedItems.map((item) => ({
        key: item.id,
        label: item.title,
        group: item.status === 'OPEN' ? '待处理' : '已归档',
      }));
    }
    if (selectedModule === 'optimize') {
      return optimizeItems.map((item) => ({
        key: item.id,
        label: item.title,
        group: item.status === 'OPEN' ? '待改写' : '已处理',
      }));
    }
    if (selectedModule === 'qa') {
      return qaRounds.map((round, index) => ({
        key: round.id,
        label: `Q${index + 1} · ${round.question}`,
        group: round.userAnswer?.trim() ? '已回答' : '待回答',
      }));
    }

    return [
      { key: 'review-overview', label: '准备度总览', group: '复盘' },
      { key: 'review-risks', label: '仍然薄弱', group: '复盘' },
      { key: 'review-plan', label: '下一步计划', group: '复盘' },
    ];
  }, [diagnosisViewModel.sortedItems, optimizeItems, qaRounds, selectedModule]);

  const moduleStatusText =
    selectedModule === 'diagnosis'
      ? `任务 ${currentJob?.status ?? 'IDLE'}`
      : selectedModule === 'optimize'
        ? `${diagnosisViewModel.optimizableCount} 条可改写`
        : selectedModule === 'qa'
          ? `进度 ${sessionProgress}%`
          : reviewReport?.readinessLevel ?? '待生成复盘';

  const senderPlaceholder =
    selectedModule === 'diagnosis'
      ? '继续输入追问、改写或复盘指令'
      : selectedModule === 'optimize'
        ? '继续输入追问、改写或复盘指令'
        : selectedModule === 'qa'
          ? '继续输入追问、改写或复盘指令'
          : '继续输入追问、改写或复盘指令';

  const senderValue =
    selectedModule === 'optimize'
      ? activeOptimizeItem
        ? manualDrafts[activeOptimizeItem.id] ?? activeOptimizeItem.editedContent ?? activeOptimizeItem.suggestion ?? ''
        : ''
      : selectedModule === 'qa'
        ? activeQaRound
          ? answerDrafts[activeQaRound.id] ?? activeQaRound.userAnswer ?? ''
          : ''
        : assistantDraft;

  const senderDisabled =
    selectedModule === 'optimize'
      ? !activeOptimizeItem
      : selectedModule === 'qa'
        ? !activeQaRound
        : selectedModule === 'review'
          ? !sessionId.trim()
          : false;

  function handleSenderChange(value: string) {
    if (selectedModule === 'optimize') {
      if (!activeOptimizeItem) {
        return;
      }
      setManualDrafts((prev) => ({
        ...prev,
        [activeOptimizeItem.id]: value,
      }));
      return;
    }

    if (selectedModule === 'qa') {
      if (!activeQaRound) {
        return;
      }
      setAnswerDrafts((prev) => ({
        ...prev,
        [activeQaRound.id]: value,
      }));
      return;
    }

    setAssistantDraft(value);
  }

  async function handleAiSubmit() {
    if (selectedModule === 'diagnosis') {
      await handleStartDiagnosis();
      setAssistantDraft('');
      return;
    }

    if (selectedModule === 'optimize') {
      if (!activeOptimizeItem) {
        messageApi.warning('当前没有可改写项');
        return;
      }
      await handleApplyAction(activeOptimizeItem, 'MANUAL_EDIT');
      return;
    }

    if (selectedModule === 'qa') {
      if (!activeQaRound) {
        messageApi.warning('请先生成追问');
        return;
      }
      await handleSubmitAnswer(activeQaRound);
      return;
    }

    await loadSessionReview();
    setAssistantDraft('');
  }

  function handlePromptSelect(key: string) {
    if (key === 'rerun-diagnosis') {
      void handleStartDiagnosis();
      return;
    }
    if (key === 'open-optimize') {
      setSelectedModule('optimize');
      return;
    }
    if (key === 'open-qa') {
      setSelectedModule('qa');
      return;
    }
    if (key === 'adopt-suggestion' && activeOptimizeItem) {
      void handleApplyAction(activeOptimizeItem, 'ADOPT');
      return;
    }
    if (key === 'ignore-suggestion' && activeOptimizeItem) {
      void handleApplyAction(activeOptimizeItem, 'IGNORE');
      return;
    }
    if (key === 'submit-answer' && activeQaRound) {
      void handleSubmitAnswer(activeQaRound);
      return;
    }
    if (key === 'generate-questions') {
      void handleGenerateQuestions();
      return;
    }
    if (key === 'generate-review') {
      void loadSessionReview();
      return;
    }
    if (key === 'refresh-trends') {
      void loadReviewTrends();
    }
  }

  const promptItems = useMemo(() => {
    if (selectedModule === 'diagnosis') {
      return [
        { key: 'rerun-diagnosis', label: '重新诊断', description: '按当前模型重新执行诊断编排。' },
        { key: 'open-optimize', label: '进入改写', description: '直接切到简历优化处理当前问题。' },
        { key: 'open-qa', label: '进入问答', description: '把当前风险转成面试追问。' },
      ];
    }

    if (selectedModule === 'optimize') {
      return [
        { key: 'adopt-suggestion', label: '采纳建议', description: '直接采用当前 AI 改写。', disabled: !activeOptimizeItem },
        { key: 'ignore-suggestion', label: '暂不处理', description: '保留该问题，留到下一轮。', disabled: !activeOptimizeItem },
        { key: 'open-qa', label: '转到问答', description: '继续准备与该问题相关的追问。' },
      ];
    }

    if (selectedModule === 'qa') {
      return [
        { key: 'submit-answer', label: '提交批改', description: '把当前回答交给 AI 批改。', disabled: !activeQaRound },
        { key: 'generate-questions', label: '继续追问', description: '继续生成下一批高频追问。', disabled: !sessionId.trim() },
        { key: 'open-optimize', label: '回到简历', description: '把暴露出的薄弱点重新写回简历。' },
      ];
    }

    return [
      { key: 'generate-review', label: '生成复盘', description: '基于当前会话输出结构化复盘。', disabled: !sessionId.trim() },
      { key: 'refresh-trends', label: '刷新趋势', description: '重新拉取近几周准备趋势。', disabled: !workspaceId.trim() },
      { key: 'open-optimize', label: '继续补强', description: '回到改写区继续处理高风险问题。' },
    ];
  }, [activeOptimizeItem, activeQaRound, selectedModule, sessionId, workspaceId]);

  const aiMessages = useMemo<WorkspaceAiMessage[]>(() => {
    if (selectedModule === 'diagnosis') {
      if (!activeDiagnosisItem) {
        return [
          {
            key: 'diagnosis-empty',
            role: 'system',
            title: '等待诊断任务',
            content: '当前还没有诊断卡片。你可以先点击右上角 `重新诊断`，或者在导入流程完成后回到这里。',
          },
        ];
      }

      return [
        {
          key: `diagnosis-summary-${activeDiagnosisItem.id}`,
          role: 'ai',
          title: '风险摘要',
          status: activeDiagnosisItem.status === 'OPEN' ? 'loading' : 'success',
          content: `### ${activeDiagnosisItem.title}\n\n- 严重级别：${severityBadgeText(activeDiagnosisItem.severity)}\n- 当前状态：${activeDiagnosisItem.status}\n- 处理建议：优先补充结果指标、技术权衡和验证证据。`,
        },
        {
          key: `diagnosis-evidence-${activeDiagnosisItem.id}`,
          role: 'system',
          title: '原始证据',
          content: `> ${(activeDiagnosisItem.userNote?.trim() || activeDiagnosisItem.description || '暂无原始证据').replace(/\n/g, '\n> ')}`,
        },
        {
          key: `diagnosis-suggestion-${activeDiagnosisItem.id}`,
          role: 'ai',
          title: 'AI 改写建议',
          content: activeDiagnosisItem.suggestion ?? '当前还没有改写建议，可以先切到“简历优化”补充自己的版本。',
        },
      ];
    }

    if (selectedModule === 'optimize') {
      if (!activeOptimizeItem) {
        return [
          {
            key: 'optimize-empty',
            role: 'system',
            title: '等待可改写项',
            content: '还没有需要处理的改写项。完成一次诊断后，这里会自动出现可编辑内容。',
          },
        ];
      }

      return [
        {
          key: `optimize-source-${activeOptimizeItem.id}`,
          role: 'system',
          title: '原文',
          content: activeOptimizeItem.userNote?.trim() || activeOptimizeItem.description || '暂无原文。',
        },
        {
          key: `optimize-suggestion-${activeOptimizeItem.id}`,
          role: 'ai',
          title: '推荐改写',
          content: activeOptimizeItem.suggestion ?? '当前没有推荐改写，可以直接在发送框里整理自己的版本。',
        },
        {
          key: `optimize-status-${activeOptimizeItem.id}`,
          role: 'ai',
          title: '当前处理状态',
          content: `- 状态：${activeOptimizeItem.status}\n- 当前编辑稿：${manualDrafts[activeOptimizeItem.id] ?? activeOptimizeItem.editedContent ?? '尚未编辑'}\n- 建议：如果已经写好，可以直接点击发送保存。`,
        },
      ];
    }

    if (selectedModule === 'qa') {
      if (!activeQaRound) {
        return [
          {
            key: 'qa-empty',
            role: 'system',
            title: '等待追问生成',
            content: '还没有问答轮次。先生成追问，AI 面板会把问题、回答和批改结果串成完整对话。',
          },
        ];
      }

      return [
        {
          key: `qa-source-${activeQaRound.id}`,
          role: 'system',
          title: '追问来源',
          content: `### ${qaViewModel.sourceTitle}\n\n${qaViewModel.sourceText}`,
        },
        {
          key: `qa-question-${activeQaRound.id}`,
          role: 'ai',
          title: '当前追问',
          content: activeQaRound.question,
        },
        {
          key: `qa-answer-${activeQaRound.id}`,
          role: 'user',
          title: '你的回答',
          content: activeQaRound.userAnswer?.trim() || '还没有提交回答。可以在底部发送区里直接组织答案。',
        },
        {
          key: `qa-feedback-${activeQaRound.id}`,
          role: 'ai',
          title: 'AI 批改结果',
          content: activeQaRound.feedback?.trim()
            ? `- 评分：${activeQaRound.score ?? '--'}\n- 反馈：${activeQaRound.feedback}\n- 补强：${qaFixSuggestions.join('\n- ')}`
            : '提交回答后，这里会显示评分、漏洞和下一轮追问建议。',
        },
      ];
    }

    return [
      {
        key: 'review-summary',
        role: 'ai',
        title: '准备度总览',
        content: `- 已准备好：${reviewPreparedCount}\n- 仍然薄弱：${reviewWeakCount}\n- 需回到简历：${reviewBackToResumeCount}`,
      },
      {
        key: 'review-tasks',
        role: 'system',
        title: '当前复盘任务',
        content: reviewTasks.map((item) => `- [${item.status === 'done' ? 'x' : ' '}] ${item.text}`).join('\n'),
      },
      {
        key: 'review-plan',
        role: 'ai',
        title: '下一步建议',
        content: reviewPlanText,
      },
    ];
  }, [
    activeDiagnosisItem,
    activeOptimizeItem,
    activeQaRound,
    diagnosisViewModel.optimizableCount,
    manualDrafts,
    qaFixSuggestions,
    qaViewModel.sourceText,
    qaViewModel.sourceTitle,
    reviewBackToResumeCount,
    reviewPlanText,
    reviewPreparedCount,
    reviewTasks,
    reviewWeakCount,
    selectedModule,
  ]);

  const moduleMainContent = (
    <WorkspaceAiPanel
      moduleTitle={currentHeader.title}
      moduleSubtitle={currentHeader.subtitle}
      moduleStatus={moduleStatusText}
      conversations={moduleConversations}
      activeConversationKey={currentConversationKey}
      onConversationChange={(key) => {
        if (selectedModule === 'diagnosis') {
          setSelectedDiagnosisItemId(key);
          return;
        }
        if (selectedModule === 'optimize') {
          setSelectedOptimizeItemId(key);
          return;
        }
        if (selectedModule === 'qa') {
          setSelectedQaRoundId(key);
        }
      }}
      messages={aiMessages}
      senderValue={senderValue}
      senderPlaceholder={senderPlaceholder}
      senderLoading={moduleActionLoading}
      senderDisabled={senderDisabled}
      onSenderChange={handleSenderChange}
      onSenderSubmit={() => void handleAiSubmit()}
      promptItems={promptItems}
      promptLabel="快捷动作"
      onPromptSelect={handlePromptSelect}
    />
  );

  return (
    <div className="draft-workspace-shell">
      {messageContextHolder}
      <aside className="draft-workspace-sidebar">
        <div className="draft-side-brand">
          <div className="draft-side-logo">
            <SearchOutlined />
          </div>
          <Text className="draft-side-title">作战包</Text>
        </div>

        <div className="draft-resume-meta">
          <Text className="draft-resume-name">{targetRole || '张三 · 后端开发'}</Text>
          <Text className="draft-resume-date">
            {currentJob?.updatedAt ? `最后更新 ${new Date(currentJob.updatedAt).toLocaleString()}` : "最后更新 --"}
          </Text>
        </div>

        <div className="draft-nav">
          {modules.map((module) => (
            <button
              key={module.value}
              type="button"
              className={`draft-nav-item ${selectedModule === module.value ? 'is-active' : ''}`}
              onClick={() => setSelectedModule(module.value)}
            >
              {module.icon}
              <span>{module.label}</span>
            </button>
          ))}
        </div>

        <div className="draft-progress">
          <Text className="draft-progress-title">准备进度 {diagnosisViewModel.progressPercent}%</Text>
          <div className="draft-progress-bar">
            <div className="draft-progress-fill" style={{ width: `${diagnosisViewModel.progressPercent}%` }} />
          </div>
          <Text className="draft-progress-hint">
            {diagnosisViewModel.pendingRiskCount} 个风险待处理 · {diagnosisViewModel.pendingAnswerCount} 个回答待批改
          </Text>
        </div>
      </aside>

      <main className="draft-workspace-main">
        <header className="draft-main-header">
          <div className="draft-main-heading">
            <Title className="draft-main-title" level={2}>
              {currentHeader.title}
            </Title>
            <Text className="draft-main-subtitle">{currentHeader.subtitle}</Text>
          </div>
          <Space size={10} wrap>
            <button type="button" className="draft-model-pill" onClick={() => setModelConfigOpen(true)}>
              <Text>{activeModelConfig?.defaultModel || "未配置模型"}</Text>
            </button>
            <Button
              className="draft-rerun-btn"
              loading={moduleActionLoading}
              onClick={() => {
                if (selectedModule === 'diagnosis') {
                  if (!jobId.trim()) {
                    messageApi.warning("请先在控制台输入并加载 jobId");
                    return;
                  }
                  void handleStartDiagnosis();
                  return;
                }
                if (selectedModule === 'optimize') {
                  if (!activeOptimizeItem) {
                    messageApi.warning("暂无可改写项，请先完成诊断");
                    return;
                  }
                  setManualDrafts((prev) => ({
                    ...prev,
                    [activeOptimizeItem.id]: prev[activeOptimizeItem.id] ?? activeOptimizeItem.suggestion ?? activeOptimizeItem.description,
                  }));
                  messageApi.success("已生成改写草稿，请继续编辑并保存");
                  return;
                }
                if (selectedModule === 'qa') {
                  if (!sessionId.trim()) {
                    messageApi.warning("请先输入并加载 sessionId");
                    return;
                  }
                  void handleGenerateQuestions();
                  return;
                }
                if (!sessionId.trim()) {
                  messageApi.warning("请先输入并加载 sessionId");
                  return;
                }
                void loadSessionReview();
              }}
            >
              {currentHeader.actionText}
            </Button>
          </Space>
        </header>

        {moduleMainContent}

        <Space wrap className="draft-console-hidden">
          {resumeId && <Tag color="blue">resumeId: {resumeId.slice(0, 10)}...</Tag>}
          {jobId && <Tag color="purple">jobId: {jobId.slice(0, 10)}...</Tag>}
          {sessionId && <Tag color="green">sessionId: {sessionId.slice(0, 10)}...</Tag>}
          <Tag color={healthText.includes("正常") ? "success" : "warning"}>{healthText}</Tag>
        </Space>
      </main>

      <ModelConfigModal
        open={modelConfigOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onClose={() => setModelConfigOpen(false)}
        onSaved={() => {
          void reloadModelConfig();
        }}
      />
    </div>
  );
}
