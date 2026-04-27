import { SearchOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { useWorkbenchStore, type ModuleKey } from '@/stores/workbench-store';

const { Text } = Typography;

const modules = [
  { value: 'diagnosis' as const, label: '简历诊断', icon: <SearchOutlined /> },
  { value: 'optimize' as const, label: '简历优化', icon: <SearchOutlined /> },
  { value: 'qa' as const, label: '问答练习', icon: <SearchOutlined /> },
  { value: 'review' as const, label: '复盘清单', icon: <SearchOutlined /> },
];

export function useWorkbenchDiagnosisViewModel() {
  const currentJob = useWorkbenchStore((state) => state.currentJob);
  const currentSession = useWorkbenchStore((state) => state.currentSession);

  const items = currentJob?.items ?? [];
  const statusWeight: Record<string, number> = {
    OPEN: 3,
    MANUALLY_EDITED: 2,
    ADOPTED: 1,
    IGNORED: 0,
  };
  const severityWeight: Record<string, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sortedItems = [...items].sort((left, right) => {
    const statusGap = (statusWeight[right.status] ?? 0) - (statusWeight[left.status] ?? 0);
    if (statusGap !== 0) return statusGap;
    return (severityWeight[right.severity] ?? 0) - (severityWeight[left.severity] ?? 0);
  });

  const issueCount = sortedItems.length;
  const highRiskCount = sortedItems.filter((item) => item.severity === 'HIGH' && item.status === 'OPEN').length;
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
    optimizableCount: sortedItems.filter((item) => item.status === 'OPEN' && Boolean(item.suggestion)).length,
    followUpCount: (currentSession?.rounds ?? []).length || issueCount * 2,
    pendingRiskCount: sortedItems.filter((item) => item.status === 'OPEN').length,
    pendingAnswerCount: Math.max(0, (currentSession?.rounds ?? []).length - answeredRounds),
    progressPercent,
  };
}

type WorkbenchSidebarProps = {
  modelConfigSummary?: {
    model: string;
    baseUrl: string;
    apiKey: string;
    healthText: string;
    onOpenConfig: () => void;
  };
};

export function WorkbenchSidebar({ modelConfigSummary }: WorkbenchSidebarProps) {
  const selectedModule = useWorkbenchStore((state) => state.selectedModule);
  const setSelectedModule = useWorkbenchStore((state) => state.setSelectedModule);
  const targetRole = useWorkbenchStore((state) => state.targetRole);
  const workspaceName = useWorkbenchStore((state) => state.workspaceName);
  const currentJob = useWorkbenchStore((state) => state.currentJob);
  const diagnosisViewModel = useWorkbenchDiagnosisViewModel();

  return (
    <aside className="draft-workspace-sidebar">
      <div className="draft-side-brand">
        <div className="draft-side-logo">
          <SearchOutlined />
        </div>
        <Text className="draft-side-title">作战包</Text>
      </div>

      <div className="draft-resume-meta">
        <Text className="draft-resume-name">{workspaceName.trim() || '当前作战包'}</Text>
        <Text className="draft-resume-date">{targetRole || '待确认岗位画像'}</Text>
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

      {modelConfigSummary ? (
        <div className="draft-side-card">
          <div className="draft-side-card-head">
            <Text className="draft-side-card-title">模型配置概览</Text>
            <Button className="draft-side-card-btn" onClick={modelConfigSummary.onOpenConfig}>
              {modelConfigSummary.model === '未配置模型' ? '配置' : '修改'}
            </Button>
          </div>
          <div className="draft-info-list">
            <div className="draft-info-row">
              <Text className="draft-info-label">默认模型</Text>
              <Text className="draft-info-value">{modelConfigSummary.model}</Text>
            </div>
            <div className="draft-info-row">
              <Text className="draft-info-label">Base URL</Text>
              <Text className="draft-info-value">{modelConfigSummary.baseUrl}</Text>
            </div>
            <div className="draft-info-row">
              <Text className="draft-info-label">API Key</Text>
              <Text className="draft-info-value">{modelConfigSummary.apiKey}</Text>
            </div>
            <div className="draft-info-row">
              <Text className="draft-info-label">API 状态</Text>
              <Text className="draft-info-value">{modelConfigSummary.healthText}</Text>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
