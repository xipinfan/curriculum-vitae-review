import { CheckCircleOutlined, EditOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModelConfigModal } from '@/components/model-config-modal';
import { useWorkspaceModelConfig } from '@/hooks/use-workspace-model-config';
import { useWorkbenchStore } from '@/stores/workbench-store';
import { createDiagnosisJob, getDiagnosisJob, listDiagnosisJobs, startDiagnosisJob } from '@/services/diagnosis';
import { importResume, parseResume } from '@/services/resumes';
import { createSession, generateSessionQuestions, getSession, getSessionProgress, listSessions } from '@/services/sessions';
import { fetchHealth } from '@/services/system';
import { WorkbenchSidebar, useWorkbenchDiagnosisViewModel } from '@/components/workbench-sidebar';
import { DiagnosisPanel } from '@/components/workbench-diagnosis-panel';
import { OptimizePanel } from '@/components/workbench-optimize-panel';
import { QAPanel } from '@/components/workbench-qa-panel';
import { ReviewPanel } from '@/components/workbench-review-panel';
import type { ConfirmedResumeIntake } from '@/types/resume';
import type { BattlePackStepKey } from '@/stores/workbench-store';
import './styles.less';

const { Title, Text } = Typography;

const headerConfig = {
  diagnosis: { title: '简历诊断', subtitle: '本页只处理简历诊断问题；优化、问答和复盘分别进入独立模块。', actionText: '重新诊断' },
  optimize: { title: '简历优化', subtitle: '逐条处理 AI 诊断项，对比原文和改写建议，保存可回退的修改记录。', actionText: '生成改写' },
  qa: { title: '问答练习', subtitle: '基于简历中的项目、技术点和风险项生成追问，保存回答草稿和 AI 批改结果。', actionText: '生成追问' },
  review: { title: '复盘清单', subtitle: '汇总简历修改、问答通过情况和仍需补强的薄弱点，形成下一轮准备计划。', actionText: '生成复盘' },
} as const;

const battlePackSteps = [
  { key: 'import' as const, title: '导入简历' },
  { key: 'parse' as const, title: '结构化解析' },
  { key: 'createJob' as const, title: '创建诊断任务' },
  { key: 'runDiagnosis' as const, title: '执行诊断分析' },
  { key: 'createSession' as const, title: '创建问答会话' },
  { key: 'generateQuestions' as const, title: '生成追问题库' },
];

export function WorkbenchPage() {
  const [messageApi, messageContextHolder] = message.useMessage();

  const store = useWorkbenchStore();
  const {
    selectedModule,
    setSelectedModule,
    healthText, setHealthText,
    workspaceId, setWorkspaceId,
    workspaceName, setWorkspaceName,
    jobId, setJobId,
    jobs, setJobs,
    currentJob, setCurrentJob,
    jobsLoading, setJobsLoading,
    jobLoading, setJobLoading,
    sessionTitle,
    sessionId, setSessionId,
    sessions, setSessions,
    currentSession, setCurrentSession,
    sessionsLoading, setSessionsLoading,
    sessionLoading, setSessionLoading,
    questionGenerating, setQuestionGenerating,
    sessionProgress, setSessionProgress,
    reviewLoading,
    resumeSourceType,
    resumeContent,
    targetRole,
    targetLevel,
    targetTechStack,
    targetBusinessDomain,
    battlePackLoading, setBattlePackLoading,
    battlePackStepState, setBattlePackStepState,
    battlePackCurrentStep, setBattlePackCurrentStep,
    battlePackError, setBattlePackError,
    resumeId, setResumeId,
    assistantDraft, setAssistantDraft,
    resetBattlePack,
  } = store;

  const bootstrappedWorkspaceIdRef = useRef('');
  const [modelConfigOpen, setModelConfigOpen] = useState(false);

  const { activeConfig: activeModelConfig, reload: reloadModelConfig } = useWorkspaceModelConfig(workspaceId);
  const diagnosisViewModel = useWorkbenchDiagnosisViewModel();

  function ensureModelConfigured() {
    if (activeModelConfig) return true;
    messageApi.warning('请先配置模型 / Base URL / API Key，避免继续使用默认模型');
    return false;
  }

  useEffect(() => {
    const savedWorkspace = localStorage.getItem('cv-review.workspaceId');
    if (savedWorkspace) setWorkspaceId(savedWorkspace);
    const savedWorkspaceName = localStorage.getItem('cv-review.workspaceName');
    if (savedWorkspaceName) setWorkspaceName(savedWorkspaceName);

    const intakeRaw = localStorage.getItem('cv-review.intake');
    if (!intakeRaw) return;
    try {
      const intake = JSON.parse(intakeRaw) as Partial<ConfirmedResumeIntake>;
      if (intake.resumeContent?.trim()) store.setResumeContent(intake.resumeContent);
      if (intake.role?.trim()) store.setTargetRole(intake.role);
      if (intake.techStack?.trim()) store.setTargetTechStack(intake.techStack);
      if (intake.level?.trim()) store.setTargetLevel(intake.level);
      if (intake.domain?.trim()) store.setTargetBusinessDomain(intake.domain);
      if (intake.resumeId?.trim()) store.setResumeId(intake.resumeId);
    } catch { /* ignore invalid local cache */ }
  }, []);

  useEffect(() => {
    if (!workspaceId.trim() || !activeModelConfig || !resumeId.trim()) return;
    if (localStorage.getItem('cv-review.autostartBattlePack') !== '1') return;
    if (battlePackLoading || currentJob || jobId) {
      localStorage.removeItem('cv-review.autostartBattlePack');
      return;
    }
    localStorage.removeItem('cv-review.autostartBattlePack');
    void handleGenerateBattlePack();
  }, [activeModelConfig, battlePackLoading, currentJob, jobId, resumeId, workspaceId]);

  useEffect(() => {
    fetchHealth()
      .then((data) => setHealthText(`API 正常 (${data.timestamp})`))
      .catch(() => setHealthText('API 未连接，请先启动后端服务'));
  }, []);

  useEffect(() => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) return;
    if (bootstrappedWorkspaceIdRef.current === normalizedWorkspaceId) return;
    bootstrappedWorkspaceIdRef.current = normalizedWorkspaceId;
    void loadJobs();
    void loadSessions();
  }, [workspaceId]);

  useEffect(() => {
    if (!currentJob || currentJob.status !== 'RUNNING') return;
    const timer = window.setInterval(() => {
      void loadJob(currentJob.id, { silent: true });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [currentJob]);

  async function loadJobs() {
    if (!workspaceId.trim()) { messageApi.warning('请先输入 workspaceId'); return; }
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

  async function loadJob(targetJobId: string = jobId, options?: { silent?: boolean }) {
    const normalized = targetJobId.trim();
    if (!normalized) { if (!options?.silent) messageApi.warning('请先输入 diagnosis jobId'); return; }
    setJobLoading(true);
    try {
      const job = await getDiagnosisJob(normalized);
      setCurrentJob(job);
      setJobId(job.id);
    } catch (error) {
      if (!options?.silent) messageApi.error(error instanceof Error ? error.message : '加载任务失败');
    } finally {
      setJobLoading(false);
    }
  }

  async function handleStartDiagnosis() {
    if (!ensureModelConfigured()) return;
    const normalized = jobId.trim();
    if (!normalized) { messageApi.warning('请先输入 diagnosis jobId'); return; }
    try {
      const result = await startDiagnosisJob(normalized);
      if (result.started) messageApi.success('诊断任务已启动');
      else messageApi.info(`任务未启动：${result.reason}`);
      await loadJob(normalized, { silent: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '启动任务失败');
    }
  }

  async function loadSessions() {
    if (!workspaceId.trim()) { messageApi.warning('请先输入 workspaceId'); return; }
    setSessionsLoading(true);
    try {
      const data = await listSessions(workspaceId.trim());
      setSessions(data);
      if (!sessionId && data.length > 0) {
        setSessionId(data[0].id);
        await loadSession(data[0].id, { silent: true });
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '加载会话列表失败');
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSession(targetSessionId: string = sessionId, options?: { silent?: boolean }) {
    const normalized = targetSessionId.trim();
    if (!normalized) { if (!options?.silent) messageApi.warning('请先输入 sessionId'); return; }
    setSessionLoading(true);
    try {
      const session = await getSession(normalized);
      setCurrentSession(session);
      setSessionId(session.id);
      const progress = await getSessionProgress(normalized);
      setSessionProgress(progress.progressPercent);
    } catch (error) {
      if (!options?.silent) messageApi.error(error instanceof Error ? error.message : '加载会话失败');
    } finally {
      setSessionLoading(false);
    }
  }

  async function waitDiagnosisCompleted(targetJobId: string) {
    const maxRetries = 30;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      const job = await getDiagnosisJob(targetJobId);
      setCurrentJob(job);
      if (job.status === 'COMPLETED') return job;
      if (job.status === 'FAILED') throw new Error(job.errorMessage ?? '诊断任务失败');
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    throw new Error('诊断执行超时，请稍后手动刷新');
  }

  async function handleGenerateQuestionsCommand() {
    if (!ensureModelConfigured()) return;
    const normalized = sessionId.trim();
    if (!normalized) { messageApi.warning('请先输入 sessionId'); return; }
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

  async function handleGenerateBattlePack() {
    if (!workspaceId.trim()) { messageApi.warning('请先输入 workspaceId'); return; }
    if (!ensureModelConfigured()) return;
    if (!resumeContent.trim() || resumeContent.trim().length < 20) { messageApi.warning('请先输入简历内容（至少 20 字）'); return; }

    setBattlePackLoading(true);
    setBattlePackError('');
    store.resetBattlePack();
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
        const resume = await importResume({ workspaceId: workspaceId.trim(), sourceType: resumeSourceType, content: resumeContent.trim() });
        resolvedResumeId = resume.id;
        setResumeId(resume.id);
        finishStep('import');
        beginStep('parse', '2/6 正在结构化解析简历...');
        await parseResume(resume.id, { force: true });
        finishStep('parse');
      }

      beginStep('createJob', '3/6 正在创建诊断任务...');
      const job = await createDiagnosisJob({ workspaceId: workspaceId.trim(), resumeDocumentId: resolvedResumeId, targetRole: targetRole.trim(), targetLevel: targetLevel.trim(), techStack: targetTechStack.trim(), businessDomain: targetBusinessDomain.trim() });
      setJobId(job.id);
      finishStep('createJob');

      beginStep('runDiagnosis', '4/6 正在执行诊断分析...');
      await startDiagnosisJob(job.id);
      const finishedJob = await waitDiagnosisCompleted(job.id);
      setCurrentJob(finishedJob);
      finishStep('runDiagnosis');

      beginStep('createSession', '5/6 正在创建问答会话...');
      const session = await createSession({ workspaceId: workspaceId.trim(), diagnosisJobId: job.id, title: `${targetRole.trim() || '岗位'}面试作战会话` });
      setSessionId(session.id);
      finishStep('createSession');

      beginStep('generateQuestions', '6/6 正在生成追问题库...');
      await generateSessionQuestions(session.id, { count: 5, focus: targetRole.trim() || '综合能力' });
      finishStep('generateQuestions');
      await loadSession(session.id, { silent: true });
      await loadJobs();
      await loadSessions();

      setSelectedModule('qa');
      messageApi.success({ content: '作战包已生成，已切换到问答练习模块', key: 'battle-pack' });
    } catch (error) {
      if (activeStep) setBattlePackStepState((prev) => ({ ...prev, [activeStep as BattlePackStepKey]: 'error' }));
      setBattlePackError(error instanceof Error ? error.message : '作战包生成失败');
      messageApi.error({ content: error instanceof Error ? error.message : '作战包生成失败', key: 'battle-pack' });
    } finally {
      setBattlePackLoading(false);
    }
  }

  useEffect(() => {
    if (diagnosisViewModel.sortedItems.length === 0) {
      if (store.selectedDiagnosisItemId) store.setSelectedDiagnosisItemId('');
      return;
    }
    if (!store.selectedDiagnosisItemId || !diagnosisViewModel.sortedItems.some((i) => i.id === store.selectedDiagnosisItemId)) {
      store.setSelectedDiagnosisItemId(diagnosisViewModel.sortedItems[0].id);
    }
  }, [diagnosisViewModel.sortedItems, store.selectedDiagnosisItemId]);

  useEffect(() => {
    if (diagnosisViewModel.sortedItems.length === 0) {
      if (store.selectedOptimizeItemId) store.setSelectedOptimizeItemId('');
      return;
    }
    if (!store.selectedOptimizeItemId || !diagnosisViewModel.sortedItems.some((i) => i.id === store.selectedOptimizeItemId)) {
      store.setSelectedOptimizeItemId(diagnosisViewModel.sortedItems[0].id);
    }
  }, [diagnosisViewModel.sortedItems, store.selectedOptimizeItemId]);

  useEffect(() => {
    const rounds = currentSession?.rounds ?? [];
    if (rounds.length === 0) {
      if (store.selectedQaRoundId) store.setSelectedQaRoundId('');
      return;
    }
    if (!store.selectedQaRoundId || !rounds.some((r) => r.id === store.selectedQaRoundId)) {
      const fallback = rounds.find((r) => !r.userAnswer?.trim()) ?? rounds[0];
      store.setSelectedQaRoundId(fallback.id);
    }
  }, [currentSession?.rounds, store.selectedQaRoundId]);

  const moduleActionLoading =
    selectedModule === 'diagnosis' ? jobLoading :
    selectedModule === 'qa' ? questionGenerating :
    reviewLoading;

  const currentHeader = headerConfig[selectedModule];

  return (
    <div className="draft-workspace-shell">
      {messageContextHolder}
      <WorkbenchSidebar />
      <main className="draft-workspace-main">
        <header className="draft-main-header">
          <div className="draft-main-heading">
            <Title className="draft-main-title" level={2}>{currentHeader.title}</Title>
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
                  if (!jobId.trim()) { messageApi.warning("请先在控制台输入并加载 jobId"); return; }
                  void handleStartDiagnosis();
                } else if (selectedModule === 'optimize') {
                  if (!store.selectedOptimizeItemId) { messageApi.warning("暂无可改写项，请先完成诊断"); return; }
                  store.setManualDrafts((prev) => ({
                    ...prev,
                    [store.selectedOptimizeItemId]: prev[store.selectedOptimizeItemId] ?? (diagnosisViewModel.sortedItems.find(i => i.id === store.selectedOptimizeItemId)?.suggestion ?? ''),
                  }));
                  messageApi.success("已生成改写草稿，请继续编辑并保存");
                } else if (selectedModule === 'qa') {
                  if (!sessionId.trim()) { messageApi.warning("请先输入并加载 sessionId"); return; }
                  void handleGenerateQuestionsCommand();
                } else {
                  if (!sessionId.trim()) { messageApi.warning("请先输入并加载 sessionId"); return; }
                }
              }}
            >
              {currentHeader.actionText}
            </Button>
          </Space>
        </header>

        {selectedModule === 'diagnosis' && <DiagnosisPanel diagnosisViewModel={diagnosisViewModel} />}
        {selectedModule === 'optimize' && <OptimizePanel items={diagnosisViewModel.sortedItems} />}
        {selectedModule === 'qa' && <QAPanel sessionId={sessionId} />}
        {selectedModule === 'review' && <ReviewPanel diagnosisViewModel={{ pendingRiskCount: diagnosisViewModel.pendingRiskCount, highRiskCount: diagnosisViewModel.highRiskCount }} sessionId={sessionId} workspaceId={workspaceId} />}

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
        onSaved={() => { void reloadModelConfig(); }}
      />
    </div>
  );
}

async function handleGenerateQuestions(this: { messageApi: ReturnType<typeof message.useMessage>[0]; sessionId: string; ensureModelConfigured: () => boolean; setQuestionGenerating: (v: boolean) => void; loadSession: (id: string, opts?: { silent?: boolean }) => Promise<void> }) {
  // Helper function used inline in the component via closure
}
