import { CheckCircleOutlined, EditOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ModelConfigModal } from '@/components/model-config-modal';
import { WorkspaceAiPanel, type WorkspaceAiConversationItem, type WorkspaceAiMessage } from '@/components/workspace-ai-panel';
import { useWorkspaceModelConfig } from '@/hooks/use-workspace-model-config';
import { useWorkbenchStore } from '@/stores/workbench-store';
import { applyDiagnosisItemAction, createDiagnosisJob, getDiagnosisJob, listDiagnosisJobs, startDiagnosisJob } from '@/services/diagnosis';
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
import type { DiagnosisItem } from '@/types/diagnosis';
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

function severityBadgeText(level: DiagnosisItem['severity']) {
  if (level === 'HIGH') return '高风险';
  if (level === 'MEDIUM') return '中风险';
  return '建议练习';
}

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
    selectedDiagnosisItemId, setSelectedDiagnosisItemId,
    selectedOptimizeItemId, setSelectedOptimizeItemId,
    selectedQaRoundId, setSelectedQaRoundId,
    manualDrafts, setManualDrafts,
    answerDrafts, setAnswerDrafts,
    reviewLoading,
    reviewReport,
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

  const [modelConfigOpen, setModelConfigOpen] = useState(false);

  const { activeConfig: activeModelConfig, reload: reloadModelConfig } = useWorkspaceModelConfig(workspaceId);
  const diagnosisViewModel = useWorkbenchDiagnosisViewModel();
  const optimizeItems = diagnosisViewModel.sortedItems;
  const activeDiagnosisItem =
    diagnosisViewModel.sortedItems.find((item) => item.id === selectedDiagnosisItemId) ??
    diagnosisViewModel.primaryIssue;
  const activeOptimizeItem =
    optimizeItems.find((item) => item.id === selectedOptimizeItemId) ??
    optimizeItems.find((item) => item.status === 'OPEN') ??
    optimizeItems[0] ??
    null;
  const qaRounds = currentSession?.rounds ?? [];
  const activeQaRound =
    qaRounds.find((round) => round.id === selectedQaRoundId) ??
    qaRounds.find((round) => !round.userAnswer?.trim()) ??
    qaRounds[0] ??
    null;

  function ensureModelConfigured() {
    if (activeModelConfig) return true;
    messageApi.warning('请先配置模型 / Base URL / API Key，当前工作台不会在未配置时继续执行');
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

  async function handleManualOptimizeSubmit() {
    if (!activeOptimizeItem || !jobId.trim()) {
      messageApi.warning('当前没有可保存的改写项');
      return;
    }

    const fallbackEditedContent = activeOptimizeItem.suggestion?.trim() || activeOptimizeItem.description.trim();
    const editedContent = manualDrafts[activeOptimizeItem.id]?.trim() || fallbackEditedContent;
    if (!editedContent) {
      messageApi.warning('手动编辑时请填写改写内容');
      return;
    }

    try {
      const updated = await applyDiagnosisItemAction(jobId, activeOptimizeItem.id, {
        action: 'MANUAL_EDIT',
        editedContent,
      });
      store.applyDiagnosisItemUpdate(updated);
      messageApi.success('已保存编辑');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '保存编辑失败');
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

  const moduleActionLoading =
    selectedModule === 'diagnosis' ? jobLoading :
    selectedModule === 'qa' ? questionGenerating :
    reviewLoading;

  const currentHeader = headerConfig[selectedModule];
  const currentConversationKey =
    selectedModule === 'diagnosis' ? activeDiagnosisItem?.id :
    selectedModule === 'optimize' ? activeOptimizeItem?.id :
    selectedModule === 'qa' ? activeQaRound?.id :
    'review-overview';

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
    selectedModule === 'diagnosis' ? `任务 ${currentJob?.status ?? 'IDLE'}` :
    selectedModule === 'optimize' ? `${diagnosisViewModel.optimizableCount} 条可改写` :
    selectedModule === 'qa' ? `进度 ${sessionProgress}%` :
    reviewReport?.readinessLevel ?? '待生成复盘';

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
    selectedModule === 'optimize' ? !activeOptimizeItem :
    selectedModule === 'qa' ? !activeQaRound :
    selectedModule === 'review' ? !sessionId.trim() :
    false;

  function handleSenderChange(value: string) {
    if (selectedModule === 'optimize') {
      if (!activeOptimizeItem) return;
      setManualDrafts((prev) => ({ ...prev, [activeOptimizeItem.id]: value }));
      return;
    }

    if (selectedModule === 'qa') {
      if (!activeQaRound) return;
      setAnswerDrafts((prev) => ({ ...prev, [activeQaRound.id]: value }));
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
      await handleManualOptimizeSubmit();
      return;
    }

    if (selectedModule === 'qa') {
      messageApi.info('请在问答练习面板提交当前回答，提交后会自动刷新批改结果');
      return;
    }

    messageApi.info('请在复盘清单面板生成或刷新复盘结果');
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
        { key: 'save-edit', label: '保存编辑', description: '保存当前手动改写版本。', disabled: !activeOptimizeItem },
        { key: 'open-qa', label: '转到问答', description: '继续准备与该问题相关的追问。' },
      ];
    }

    if (selectedModule === 'qa') {
      return [
        { key: 'generate-questions', label: '继续追问', description: '继续生成下一批高频追问。', disabled: !sessionId.trim() },
        { key: 'open-optimize', label: '回到简历', description: '把暴露出的薄弱点重新写回简历。' },
      ];
    }

    return [
      { key: 'open-diagnosis', label: '回到诊断', description: '继续处理未关闭的风险项。' },
      { key: 'open-qa', label: '继续问答', description: '回到问答模块补齐回答。' },
    ];
  }, [activeOptimizeItem, selectedModule, sessionId]);

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
    if (key === 'open-diagnosis') {
      setSelectedModule('diagnosis');
      return;
    }
    if (key === 'generate-questions') {
      void handleGenerateQuestionsCommand();
      return;
    }
    if (key === 'save-edit') {
      void handleManualOptimizeSubmit();
    }
  }

  const aiMessages = useMemo<WorkspaceAiMessage[]>(() => {
    if (selectedModule === 'diagnosis') {
      if (!activeDiagnosisItem) {
        return [{
          key: 'diagnosis-empty',
          role: 'system',
          title: '等待诊断任务',
          content: '当前还没有诊断卡片。你可以先点击右上角 `重新诊断`，或者在导入流程完成后回到这里。',
        }];
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
        return [{
          key: 'optimize-empty',
          role: 'system',
          title: '等待可改写项',
          content: '还没有需要处理的改写项。完成一次诊断后，这里会自动出现可编辑内容。',
        }];
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
      ];
    }

    if (selectedModule === 'qa') {
      if (!activeQaRound) {
        return [{
          key: 'qa-empty',
          role: 'system',
          title: '等待追问生成',
          content: '还没有问答轮次。先生成追问，AI 面板会把问题、回答和批改结果串成完整对话。',
        }];
      }

      return [
        { key: `qa-question-${activeQaRound.id}`, role: 'ai', title: '当前追问', content: activeQaRound.question },
        {
          key: `qa-answer-${activeQaRound.id}`,
          role: 'user',
          title: '你的回答',
          content: activeQaRound.userAnswer?.trim() || '还没有提交回答。可以在底部发送区里先组织答案。',
        },
        {
          key: `qa-feedback-${activeQaRound.id}`,
          role: 'ai',
          title: 'AI 批改结果',
          content: activeQaRound.feedback?.trim()
            ? `- 评分：${activeQaRound.score ?? '--'}\n- 反馈：${activeQaRound.feedback}\n- 补强：${activeQaRound.followUpQuestion ?? '继续补充项目背景、动作和结果'}`
            : '提交回答后，这里会显示评分、漏洞和下一轮追问建议。',
        },
      ];
    }

    return [
      {
        key: 'review-summary',
        role: 'ai',
        title: '准备度总览',
        content: `- 待处理风险：${diagnosisViewModel.pendingRiskCount}\n- 高风险：${diagnosisViewModel.highRiskCount}\n- 当前会话：${sessionId || '未建立'}`,
      },
    ];
  }, [
    activeDiagnosisItem,
    activeOptimizeItem,
    activeQaRound,
    diagnosisViewModel.highRiskCount,
    diagnosisViewModel.pendingRiskCount,
    selectedModule,
    sessionId,
  ]);

  const modelConfigSummary = {
    model: activeModelConfig?.defaultModel?.trim() || '未配置模型',
    baseUrl: activeModelConfig?.baseUrl?.trim() || '未配置',
    apiKey: activeModelConfig?.apiKeyMasked?.trim() || '未配置',
    healthText,
    onOpenConfig: () => setModelConfigOpen(true),
  };

  return (
    <div className="draft-workspace-shell">
      {messageContextHolder}
      <WorkbenchSidebar modelConfigSummary={modelConfigSummary} />
      <main className="draft-workspace-main">
        <header className="draft-main-header">
          <div className="draft-main-heading">
            <Title className="draft-main-title" level={2}>{currentHeader.title}</Title>
            <Text className="draft-main-subtitle">{currentHeader.subtitle}</Text>
          </div>
          <Space size={10} wrap>
            <button type="button" className="draft-model-pill" onClick={() => setModelConfigOpen(true)}>
              <Text>{activeModelConfig?.defaultModel || '未配置模型'}</Text>
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

        <WorkspaceAiPanel
          moduleTitle={currentHeader.title}
          moduleSubtitle={currentHeader.subtitle}
          moduleStatus={moduleStatusText}
          conversations={moduleConversations}
          activeConversationKey={currentConversationKey}
          onConversationChange={(key) => {
            if (selectedModule === 'diagnosis') setSelectedDiagnosisItemId(key);
            if (selectedModule === 'optimize') setSelectedOptimizeItemId(key);
            if (selectedModule === 'qa') setSelectedQaRoundId(key);
          }}
          messages={aiMessages}
          senderValue={senderValue}
          senderPlaceholder="继续输入追问、改写或复盘指令"
          senderLoading={moduleActionLoading}
          senderDisabled={senderDisabled}
          onSenderChange={handleSenderChange}
          onSenderSubmit={() => void handleAiSubmit()}
          promptItems={promptItems}
          promptLabel="快捷动作"
          onPromptSelect={handlePromptSelect}
        />

        {selectedModule === 'diagnosis' && <DiagnosisPanel diagnosisViewModel={diagnosisViewModel} />}
        {selectedModule === 'optimize' && <OptimizePanel items={diagnosisViewModel.sortedItems} />}
        {selectedModule === 'qa' && <QAPanel sessionId={sessionId} onSessionReload={loadSession} />}
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
