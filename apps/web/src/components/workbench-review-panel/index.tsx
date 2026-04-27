import { ReloadOutlined } from '@ant-design/icons';
import { Button, Typography, message } from 'antd';
import { useState } from 'react';
import { useWorkbenchStore } from '@/stores/workbench-store';
import { getSessionReview, getSessionReviewTrends } from '@/services/sessions';
import type { SessionReviewReport } from '@/types/sessions';

const { Text } = Typography;

type ReviewPanelProps = {
  diagnosisViewModel: {
    pendingRiskCount: number;
    highRiskCount: number;
  };
  sessionId: string;
  workspaceId: string;
};

function readinessColor(level: SessionReviewReport['readinessLevel']) {
  if (level === 'READY') return 'success';
  if (level === 'IMPROVING') return 'processing';
  return 'error';
}

export function ReviewPanel({ diagnosisViewModel, sessionId, workspaceId }: ReviewPanelProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const reviewReport = useWorkbenchStore((state) => state.reviewReport);
  const setReviewReport = useWorkbenchStore((state) => state.setReviewReport);
  const reviewLoading = useWorkbenchStore((state) => state.reviewLoading);
  const setReviewLoading = useWorkbenchStore((state) => state.setReviewLoading);
  const reviewTrends = useWorkbenchStore((state) => state.reviewTrends);
  const setReviewTrends = useWorkbenchStore((state) => state.setReviewTrends);
  const reviewTrendsLoading = useWorkbenchStore((state) => state.reviewTrendsLoading);
  const setReviewTrendsLoading = useWorkbenchStore((state) => state.setReviewTrendsLoading);
  const trendWeeks = useWorkbenchStore((state) => state.trendWeeks);
  const setTrendWeeks = useWorkbenchStore((state) => state.setTrendWeeks);
  const currentSession = useWorkbenchStore((state) => state.currentSession);

  async function loadSessionReview(targetSessionId = sessionId) {
    const normalized = targetSessionId.trim();
    if (!normalized) {
      messageApi.warning('请先输入 sessionId');
      return;
    }

    setReviewLoading(true);
    try {
      const report = await getSessionReview(normalized);
      setReviewReport(report);
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

  return (
    <div className="draft-review-body">
      {messageContextHolder}
      <div className="draft-review-metrics">
        <div className="draft-review-metric-card">
          <Text className="draft-review-metric-label">已准备好</Text>
          <Text className="draft-review-metric-value is-green">{reviewPreparedCount}</Text>
        </div>
        <div className="draft-review-metric-card">
          <Text className="draft-review-metric-label">仍然薄弱</Text>
          <Text className="draft-review-metric-value is-brown">{reviewWeakCount}</Text>
        </div>
        <div className="draft-review-metric-card">
          <Text className="draft-review-metric-label">需回到简历</Text>
          <Text className="draft-review-metric-value is-red">{reviewBackToResumeCount}</Text>
        </div>
      </div>

      <div className="draft-review-task-card">
        <Text className="draft-review-task-title">当前复盘任务</Text>
        {reviewTasks.map((task, index) => (
          <div key={index} className={`draft-review-task-item ${task.status}`}>
            <div className="draft-review-task-dot" />
            <Text className="draft-review-task-text">{task.text}</Text>
          </div>
        ))}
      </div>

      <div className="draft-review-plan-card">
        <Text className="draft-review-plan-title">下一步建议</Text>
        <Text className="draft-review-plan-text">{reviewPlanText}</Text>
      </div>

      <Button
        icon={<ReloadOutlined />}
        loading={reviewTrendsLoading}
        onClick={() => void loadReviewTrends()}
        className="draft-btn-primary"
      >
        刷新趋势 ({trendWeeks} 周)
      </Button>
    </div>
  );
}
