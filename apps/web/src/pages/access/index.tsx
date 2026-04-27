import { ArrowRightOutlined, FileTextOutlined, InfoCircleOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import { Button, Input, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelConfigModal } from '@/components/model-config-modal';
import { useWorkspaceModelConfig } from '@/hooks/use-workspace-model-config';
import { createWorkspace, validateWorkspaceAccessKey } from '@/services/workspaces';
import './styles.less';

const { Title, Text } = Typography;

function buildWorkspaceNameFromKey(rawKey: string) {
  const normalized = rawKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `作战包 ${normalized.slice(-6) || 'WORKSPACE'}`;
}

export function AccessKeyPage() {
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [accessKey, setAccessKey] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const { activeConfig, reload: reloadActiveConfig } = useWorkspaceModelConfig(workspaceId);

  useEffect(() => {
    setAccessKey(localStorage.getItem('cv-review.accessKey') ?? '');
    setWorkspaceId(localStorage.getItem('cv-review.workspaceId') ?? '');
    setWorkspaceName(localStorage.getItem('cv-review.workspaceName') ?? '');
  }, []);

  function persistWorkspace(nextWorkspaceId: string, nextWorkspaceName: string, nextAccessKey: string) {
    localStorage.setItem('cv-review.accessKey', nextAccessKey);
    localStorage.setItem('cv-review.workspaceId', nextWorkspaceId);
    localStorage.setItem('cv-review.workspaceName', nextWorkspaceName);
    setWorkspaceId(nextWorkspaceId);
    setWorkspaceName(nextWorkspaceName);
  }

  async function ensureWorkspace() {
    const normalized = accessKey.trim();
    if (normalized.length < 6) {
      messageApi.warning('请输入有效访问密钥');
      return null;
    }

    try {
      const validation = await validateWorkspaceAccessKey(normalized);
      if (validation.valid && validation.workspaceId) {
        persistWorkspace(validation.workspaceId, validation.workspaceName ?? buildWorkspaceNameFromKey(normalized), normalized);
        return {
          workspaceId: validation.workspaceId,
          workspaceName: validation.workspaceName ?? buildWorkspaceNameFromKey(normalized),
        };
      }

      const created = await createWorkspace({
        name: buildWorkspaceNameFromKey(normalized),
        accessKey: normalized,
      });
      persistWorkspace(created.id, created.name, normalized);
      messageApi.success('首次访问成功，已创建工作空间');
      return {
        workspaceId: created.id,
        workspaceName: created.name,
      };
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '访问密钥校验失败');
      return null;
    }
  }

  async function handleEnterWorkspace() {
    const resolved = await ensureWorkspace();
    if (!resolved) {
      return;
    }
    void navigate('/intake');
  }

  async function handleOpenConfig() {
    const resolved = await ensureWorkspace();
    if (!resolved) {
      return;
    }
    setConfigOpen(true);
  }

  return (
    <div className="access-shell">
      {messageContextHolder}
      <div className="access-frame">
        <header className="access-topbar">
          <div className="access-brand">
            <div className="access-brand-mark">
              <FileTextOutlined />
            </div>
            <Text className="access-brand-text">CV Review</Text>
          </div>

          <button type="button" className="access-admin-pill" onClick={() => void handleOpenConfig()}>
            <KeyOutlined />
            <span>{activeConfig ? '模型配置已连接' : '模型配置'}</span>
          </button>
        </header>

        <section className="access-body">
          <div className="access-intro">
            <Text className="access-eyebrow">私有部署 · 多 workspace 隔离</Text>
            <Title level={1} className="access-title">
              把简历变成可复盘的面试作战包
            </Title>
            <Text className="access-desc">从简历诊断、表达优化到高频追问练习，所有进度结构化保存，方便中断后继续准备。</Text>

            <div className="access-feature-row">
              <div className="access-feature-card">
                <Text className="access-feature-title">诊断风险</Text>
                <Text className="access-feature-desc">定位空洞表述、指标缺失、项目追问点</Text>
              </div>
              <div className="access-feature-card">
                <Text className="access-feature-title">问答练习</Text>
                <Text className="access-feature-desc">生成追问、批改回答、继续追问补强</Text>
              </div>
            </div>
          </div>

          <div className="access-card">
            <div className="access-card-head">
              <Title level={3} className="access-card-title">
                使用访问密钥进入
              </Title>
              <Text className="access-card-sub">每个访问密钥对应独立 workspace。管理员只管理密钥，不在界面查看用户简历。</Text>
            </div>

            <div className="access-field">
              <Text className="access-field-label">访问密钥</Text>
              <div className="access-input-wrap">
                <LockOutlined />
                <Input
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="cvk_live_••••••••••••"
                  variant="borderless"
                />
              </div>
            </div>

            <Button className="access-enter-btn" block onClick={handleEnterWorkspace}>
              进入工作台 <ArrowRightOutlined />
            </Button>

            <div className="access-config-card">
              <div>
                <Text className="access-config-title">模型 / Base URL / API Key</Text>
                <Text className="access-config-desc">
                  {activeConfig
                    ? `${activeConfig.defaultModel || '未设默认模型'} · ${activeConfig.baseUrl}`
                    : '当前还没有绑定模型供应商，请先配置后再开始诊断。'}
                </Text>
              </div>
              <Button className="access-config-btn" onClick={() => void handleOpenConfig()}>
                {activeConfig ? '修改配置' : '立即配置'}
              </Button>
            </div>

            <div className="access-notice">
              <InfoCircleOutlined />
              <Text>第一次进入后会创建工作空间并保存后续诊断进度。</Text>
            </div>
          </div>
        </section>
      </div>

      <ModelConfigModal
        open={configOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onClose={() => setConfigOpen(false)}
        onSaved={() => {
          void reloadActiveConfig();
        }}
      />
    </div>
  );
}
