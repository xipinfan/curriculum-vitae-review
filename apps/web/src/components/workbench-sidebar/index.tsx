import { SearchOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { useWorkbenchStore, type ModuleKey } from '@/stores/workbench-store';
import './styles.less';

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

export function WorkbenchSidebar() {
  const selectedModule = useWorkbenchStore((state) => state.selectedModule);
  const setSelectedModule = useWorkbenchStore((state) => state.setSelectedModule);
  const targetRole = useWorkbenchStore((state) => state.targetRole);
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
  );
}
