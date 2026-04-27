import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Input, Tag, Typography, message } from 'antd';
import { useMemo } from 'react';
import { useWorkbenchStore } from '@/stores/workbench-store';
import { submitSessionAnswer, generateSessionQuestions } from '@/services/sessions';
import type { DiagnosisItem } from '@/types/diagnosis';
import type { SessionRound } from '@/types/sessions';
import './styles.less';

const { Text } = Typography;

type QAPanelProps = {
  sessionId: string;
};

function scoreTagColor(score: number | null) {
  if (typeof score !== 'number') return 'default';
  if (score >= 85) return 'success';
  if (score >= 70) return 'processing';
  return 'error';
}

export function QAPanel({ sessionId }: QAPanelProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const currentJob = useWorkbenchStore((state) => state.currentJob);
  const currentSession = useWorkbenchStore((state) => state.currentSession);
  const selectedQaRoundId = useWorkbenchStore((state) => state.selectedQaRoundId);
  const setSelectedQaRoundId = useWorkbenchStore((state) => state.setSelectedQaRoundId);
  const answerDrafts = useWorkbenchStore((state) => state.answerDrafts);
  const setAnswerDrafts = useWorkbenchStore((state) => state.setAnswerDrafts);
  const answerLoadingByRound = useWorkbenchStore((state) => state.answerLoadingByRound);
  const setAnswerLoadingByRound = useWorkbenchStore((state) => state.setAnswerLoadingByRound);
  const questionGenerating = useWorkbenchStore((state) => state.questionGenerating);
  const setQuestionGenerating = useWorkbenchStore((state) => state.setQuestionGenerating);
  const sessionProgress = useWorkbenchStore((state) => state.sessionProgress);
  const setSessionLoading = useWorkbenchStore((state) => state.setSessionLoading);

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
      sourceText: sourceItem?.description ?? '请先加载诊断任务',
      sourceSuggestion: sourceItem?.suggestion ?? '优先补充量化指标、技术权衡和结果验证方式。',
      activeRound,
      queue,
    };
  }, [currentJob, currentSession, selectedQaRoundId]);

  const activeRound = qaViewModel.activeRound;

  const qaFixSuggestions = useMemo(() => {
    const candidates = [
      activeRound?.feedback?.trim(),
      activeRound?.followUpQuestion?.trim() ? `继续追问：${activeRound.followUpQuestion.trim()}` : '',
      qaViewModel.sourceSuggestion?.trim(),
    ].filter((item): item is string => Boolean(item));

    return Array.from(new Set(candidates)).slice(0, 3);
  }, [activeRound, qaViewModel.sourceSuggestion]);

  async function handleSubmitAnswer(round: SessionRound) {
    const draft = answerDrafts[round.id]?.trim();
    if (!currentSession) return;
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
      setSessionLoading(true);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '提交回答失败');
    } finally {
      setAnswerLoadingByRound((prev) => ({ ...prev, [round.id]: false }));
    }
  }

  async function handleGenerateQuestions() {
    const normalized = sessionId.trim();
    if (!normalized) {
      messageApi.warning('请先输入 sessionId');
      return;
    }
    setQuestionGenerating(true);
    try {
      const generated = await generateSessionQuestions(normalized, { count: 4 });
      messageApi.success(`已生成 ${generated.generatedCount} 道问题`);
      setSessionLoading(true);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '生成问题失败');
    } finally {
      setQuestionGenerating(false);
    }
  }

  if (!activeRound) {
    return (
      <div className="draft-empty-issue">
        {messageContextHolder}
        <div className="draft-qa-bank">
          <Text className="draft-qa-bank-title">问答练习</Text>
          <Text className="draft-qa-bank-hint">先生成追问，AI 面板会把问题、回答和批改结果串成完整对话。</Text>
        </div>
      </div>
    );
  }

  return (
    <>
      {messageContextHolder}
      <div className="draft-qa-body">
        <div className="draft-qa-left">
          <div className="draft-qa-source-card">
            <Text className="draft-qa-source-title">追问来源</Text>
            <Text className="draft-qa-source-text">{qaViewModel.sourceTitle}</Text>
            <Text className="draft-qa-source-hint">{qaViewModel.sourceText}</Text>
            <Text className="draft-qa-source-hint">{qaViewModel.sourceSuggestion}</Text>
          </div>

          <div className="draft-qa-question-focus">
            <Text className="draft-qa-focus-title">当前追问</Text>
            <Text className="draft-qa-focus-text">{activeRound.question}</Text>
          </div>

          <div className="draft-qa-upcoming">
            <Text className="draft-qa-upcoming-title">即将追问 ({qaViewModel.queue.length})</Text>
            {qaViewModel.queue.length === 0 ? (
              <Text className="draft-qa-upcoming-item">暂无更多追问</Text>
            ) : (
              qaViewModel.queue.map((round) => (
                <button
                  key={round.id}
                  type="button"
                  className={`draft-qa-queue-item ${round.id === selectedQaRoundId ? 'is-active' : ''} ${round.userAnswer?.trim() ? 'is-pass' : ''}`}
                  onClick={() => setSelectedQaRoundId(round.id)}
                >
                  <Text className="draft-qa-queue-item-title">{round.question}</Text>
                  <Text className="draft-qa-queue-item-hint">
                    {round.userAnswer?.trim() ? '已回答' : '待回答'}
                  </Text>
                </button>
              ))
            )}
          </div>

          <div className="draft-qa-actions">
            <Button
              className="draft-qa-btn-primary"
              icon={<SendOutlined />}
              loading={answerLoadingByRound[activeRound.id]}
              onClick={() => void handleSubmitAnswer(activeRound)}
            >
              提交批改
            </Button>
            <Button
              className="draft-qa-btn-outline"
              icon={<ThunderboltOutlined />}
              loading={questionGenerating}
              onClick={() => void handleGenerateQuestions()}
            >
              生成追问
            </Button>
          </div>
        </div>

        <div className="draft-qa-right">
          <div className="draft-qa-card draft-qa-card-muted">
            <Text className="draft-qa-card-title">你的回答</Text>
            <Input.TextArea
              value={answerDrafts[activeRound.id] ?? activeRound.userAnswer ?? ''}
              onChange={(event) =>
                setAnswerDrafts((prev) => ({
                  ...prev,
                  [activeRound.id]: event.target.value,
                }))
              }
              autoSize={{ minRows: 5, maxRows: 10 }}
              placeholder="在此输入你的 STAR 回答..."
            />
          </div>

          {activeRound.feedback && (
            <div className="draft-qa-card draft-qa-card-grading">
              <div className="draft-qa-card-grading-top">
                <Text className="draft-qa-card-title draft-qa-card-title-brown">AI 批改结果</Text>
                <Text className="draft-qa-card-score">{activeRound.score ?? '--'}</Text>
                <Tag color={scoreTagColor(activeRound.score)}>{activeRound.score ?? '--'} 分</Tag>
              </div>
              <Text className="draft-qa-card-text-brown">{activeRound.feedback}</Text>
            </div>
          )}

          <div className="draft-qa-fix-card">
            <Text className="draft-qa-fix-title">待补强</Text>
            {qaFixSuggestions.map((suggestion, index) => (
              <Text key={index} className="draft-qa-fix-item">{suggestion}</Text>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
