import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Typography, message } from 'antd';
import type { DiagnosisItem } from '@/types/diagnosis';
import { useWorkbenchStore } from '@/stores/workbench-store';
import { applyDiagnosisItemAction } from '@/services/diagnosis';
import './styles.less';

const { Text } = Typography;

type OptimizePanelProps = {
  items: DiagnosisItem[];
};

export function OptimizePanel({ items }: OptimizePanelProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const selectedOptimizeItemId = useWorkbenchStore((state) => state.selectedOptimizeItemId);
  const setSelectedOptimizeItemId = useWorkbenchStore((state) => state.setSelectedOptimizeItemId);
  const manualDrafts = useWorkbenchStore((state) => state.manualDrafts);
  const setManualDrafts = useWorkbenchStore((state) => state.setManualDrafts);
  const actionLoadingByItem = useWorkbenchStore((state) => state.actionLoadingByItem);
  const setActionLoadingByItem = useWorkbenchStore((state) => state.setActionLoadingByItem);
  const jobId = useWorkbenchStore((state) => state.jobId);
  const applyUpdate = useWorkbenchStore((state) => state.applyDiagnosisItemUpdate);

  const activeItem = items.find((item) => item.id === selectedOptimizeItemId) ?? items.find((item) => item.status === 'OPEN') ?? items[0] ?? null;
  const optimizableCount = items.filter((item) => item.status === 'OPEN' && Boolean(item.suggestion)).length;

  async function handleApplyAction(item: DiagnosisItem, action: 'ADOPT' | 'IGNORE' | 'MANUAL_EDIT') {
    if (!item || !jobId) return;

    const fallbackEditedContent = item.suggestion?.trim() || item.description?.trim();
    const editedContent = action === 'MANUAL_EDIT' ? manualDrafts[item.id]?.trim() || fallbackEditedContent : undefined;
    if (action === 'MANUAL_EDIT' && !editedContent) {
      messageApi.warning('手动编辑时请填写改写内容');
      return;
    }

    setActionLoadingByItem((prev) => ({ ...prev, [item.id]: true }));
    try {
      const updated = await applyDiagnosisItemAction(jobId, item.id, { action, editedContent });
      applyUpdate(updated);
      messageApi.success(action === 'ADOPT' ? '已采纳' : action === 'IGNORE' ? '已忽略' : '已保存编辑');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoadingByItem((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  if (items.length === 0) {
    return (
      <div className="draft-empty-issue">
        {messageContextHolder}
        <Empty description="暂无可改写项" />
        <Text className="draft-empty-desc">完成一次诊断后，这里会自动出现可编辑内容。</Text>
      </div>
    );
  }

  return (
    <>
      {messageContextHolder}
      <div className="draft-optimize-body">
        <div className="draft-optimize-left">
          <div className="draft-optimize-overview">
            <Text className="draft-optimize-overview-title">可改写项目</Text>
            <Text className="draft-optimize-overview-value">{optimizableCount}</Text>
            <Text className="draft-optimize-overview-hint">项有机可改写建议</Text>
          </div>

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`draft-optimize-item ${item.id === selectedOptimizeItemId ? 'is-active' : ''}`}
              onClick={() => setSelectedOptimizeItemId(item.id)}
            >
              <Text className="draft-optimize-item-title">{item.title}</Text>
              <Text className="draft-optimize-item-hint">
                {item.status === 'OPEN' ? '待改写' : '已处理'}
              </Text>
            </button>
          ))}
        </div>

        <div className="draft-optimize-right">
          {activeItem && (
            <>
              <div className="draft-optimize-card">
                <Text className="draft-optimize-card-title">原文</Text>
                <Text className="draft-optimize-card-text">
                  {activeItem.userNote?.trim() || activeItem.description || '暂无原文'}
                </Text>
              </div>

              <div className="draft-optimize-card draft-optimize-card-green">
                <Text className="draft-optimize-card-title draft-optimize-card-title-green">推荐改写</Text>
                <Text className="draft-optimize-card-text draft-optimize-card-text-green">
                  {activeItem.suggestion || '当前没有改写建议'}
                </Text>
              </div>

              <div className="draft-optimize-editor">
                <Text className="draft-optimize-card-title">你的编辑版本</Text>
                <Input.TextArea
                  value={manualDrafts[activeItem.id] ?? activeItem.editedContent ?? activeItem.suggestion ?? ''}
                  onChange={(event) =>
                    setManualDrafts((prev) => ({
                      ...prev,
                      [activeItem.id]: event.target.value,
                    }))
                  }
                  autoSize={{ minRows: 4, maxRows: 8 }}
                />
              </div>

              <div className="draft-optimize-actions">
                <Button
                  className="draft-btn-primary"
                  icon={<CheckOutlined />}
                  loading={actionLoadingByItem[activeItem.id]}
                  onClick={() => void handleApplyAction(activeItem, 'ADOPT')}
                >
                  采纳此建议
                </Button>
                <Button
                  className="draft-btn-outline"
                  icon={<EditOutlined />}
                  onClick={() => void handleApplyAction(activeItem, 'MANUAL_EDIT')}
                >
                  保存编辑
                </Button>
                <Button
                  className="draft-btn-outline"
                  icon={<CloseOutlined />}
                  onClick={() => void handleApplyAction(activeItem, 'IGNORE')}
                >
                  暂不处理
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
