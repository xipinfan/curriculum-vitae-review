import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Empty, Typography } from 'antd';
import type { DiagnosisItem } from '@/types/diagnosis';
import { useWorkbenchStore } from '@/stores/workbench-store';
import { applyDiagnosisItemAction } from '@/services/diagnosis';
import { message } from 'antd';
import './styles.less';

const { Text } = Typography;

type DiagnosisPanelProps = {
  diagnosisViewModel: {
    sortedItems: DiagnosisItem[];
    primaryIssue: DiagnosisItem | null;
    secondaryIssues: DiagnosisItem[];
    issueCount: number;
    highRiskCount: number;
    optimizableCount: number;
    followUpCount: number;
  };
};

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

export function DiagnosisPanel({ diagnosisViewModel }: DiagnosisPanelProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const selectedDiagnosisItemId = useWorkbenchStore((state) => state.selectedDiagnosisItemId);
  const setSelectedDiagnosisItemId = useWorkbenchStore((state) => state.setSelectedDiagnosisItemId);
  const actionLoadingByItem = useWorkbenchStore((state) => state.actionLoadingByItem);
  const setActionLoadingByItem = useWorkbenchStore((state) => state.setActionLoadingByItem);
  const jobId = useWorkbenchStore((state) => state.jobId);
  const applyUpdate = useWorkbenchStore((state) => state.applyDiagnosisItemUpdate);

  const activeItem = diagnosisViewModel.sortedItems.find((item) => item.id === selectedDiagnosisItemId) ?? diagnosisViewModel.primaryIssue;

  async function handleApplyAction(item: DiagnosisItem, action: 'ADOPT' | 'IGNORE') {
    if (!item || !jobId) return;

    setActionLoadingByItem((prev) => ({ ...prev, [item.id]: true }));
    try {
      const updated = await applyDiagnosisItemAction(jobId, item.id, { action });
      applyUpdate(updated);
      messageApi.success(action === 'ADOPT' ? '已采纳' : '已忽略');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoadingByItem((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  if (diagnosisViewModel.issueCount === 0) {
    return (
      <div className="draft-empty-issue">
        {messageContextHolder}
        <Empty description="暂无诊断结果">
          <Text className="draft-empty-desc">点击右上角「重新诊断」开始首次分析，或在导入流程完成后回到这里。</Text>
        </Empty>
      </div>
    );
  }

  return (
    <>
      {messageContextHolder}
      <div className="draft-summary-row">
        <div className="draft-summary-card">
          <Text className="draft-summary-label">高风险问题</Text>
          <Text className="draft-summary-value">{diagnosisViewModel.highRiskCount}</Text>
          <Text className="draft-summary-hint draft-summary-hint-risk">需优先处理</Text>
        </div>
        <div className="draft-summary-card">
          <Text className="draft-summary-label">可改写</Text>
          <Text className="draft-summary-value">{diagnosisViewModel.optimizableCount}</Text>
          <Text className="draft-summary-hint">有机可改写建议</Text>
        </div>
        <div className="draft-summary-card">
          <Text className="draft-summary-label">待追问</Text>
          <Text className="draft-summary-value">{diagnosisViewModel.followUpCount}</Text>
          <Text className="draft-summary-hint">可生成面试追问</Text>
        </div>
      </div>

      {diagnosisViewModel.primaryIssue && (
        <div className="draft-detail-layout">
          <div className="draft-detail-main">
            <div
              className={`draft-issue-card draft-issue-primary ${selectedDiagnosisItemId === diagnosisViewModel.primaryIssue.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedDiagnosisItemId(diagnosisViewModel.primaryIssue!.id)}
            >
              <div className="draft-issue-top">
                <Text className="draft-issue-title">{diagnosisViewModel.primaryIssue.title}</Text>
                <span className={`draft-issue-badge ${severityBadgeClass(diagnosisViewModel.primaryIssue.severity)}`}>
                  {severityBadgeText(diagnosisViewModel.primaryIssue.severity)}
                </span>
              </div>
              <Text className="draft-issue-desc">{diagnosisViewModel.primaryIssue.description}</Text>
              {diagnosisViewModel.primaryIssue.userNote && (
                <div className="draft-issue-quote">
                  <Text className="draft-issue-block-label">原始表述</Text>
                  <Text className="draft-issue-block-text">{diagnosisViewModel.primaryIssue.userNote}</Text>
                </div>
              )}
              {diagnosisViewModel.primaryIssue.suggestion && (
                <div className="draft-issue-suggestion">
                  <Text className="draft-issue-block-label draft-issue-block-label-green">AI 改写建议</Text>
                  <Text className="draft-issue-block-text draft-issue-block-text-green">{diagnosisViewModel.primaryIssue.suggestion}</Text>
                </div>
              )}
            </div>

            <div className="draft-issue-actions">
              <Button
                className="draft-issue-btn"
                icon={<CheckOutlined />}
                loading={actionLoadingByItem[diagnosisViewModel.primaryIssue.id]}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApplyAction(diagnosisViewModel.primaryIssue!, 'ADOPT');
                }}
              >
                采纳此建议
              </Button>
              <Button
                className="draft-issue-btn"
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApplyAction(diagnosisViewModel.primaryIssue!, 'IGNORE');
                }}
              >
                暂不处理
              </Button>
            </div>
          </div>

          <div className="draft-detail-actions">
            {diagnosisViewModel.secondaryIssues.map((item) => (
              <div
                key={item.id}
                className={`draft-issue-card draft-issue-compact ${selectedDiagnosisItemId === item.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedDiagnosisItemId(item.id)}
              >
                <div className="draft-issue-top">
                  <Text className="draft-issue-compact-title">{item.title}</Text>
                  <span className={`draft-issue-badge ${severityBadgeClass(item.severity)}`}>
                    {severityBadgeText(item.severity)}
                  </span>
                </div>
                <Text className="draft-issue-desc">{item.description}</Text>
              </div>
            ))}
            {diagnosisViewModel.secondaryIssues.length === 0 && (
              <Empty description="没有更多诊断项" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
