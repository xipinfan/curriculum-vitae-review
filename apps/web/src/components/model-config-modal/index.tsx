import { Alert, Button, Input, Modal, Space, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  createModelConfig,
  listModelConfigModels,
  listModelConfigs,
  testDirectModelConnection,
  testModelConfigConnection,
  updateModelConfig,
} from '@/services/model-configs';
import type {
  ModelConfigConnectionResult,
  ModelConfigRecord,
  ModelConfigStatus,
} from '@/types/model-configs';
import './styles.less';

const { Text } = Typography;

type ModelConfigModalProps = {
  open: boolean;
  workspaceId: string;
  workspaceName?: string;
  onClose: () => void;
  onSaved?: (config: ModelConfigRecord | null) => void;
};

function pickPrimaryConfig(configs: ModelConfigRecord[]) {
  return configs.find((item) => item.status === 'ACTIVE') ?? configs[0] ?? null;
}

export function ModelConfigModal({ open, workspaceId, workspaceName, onClose, onSaved }: ModelConfigModalProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [configs, setConfigs] = useState<ModelConfigRecord[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [name, setName] = useState('默认模型配置');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [status, setStatus] = useState<ModelConfigStatus>('ACTIVE');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<ModelConfigConnectionResult | null>(null);

  const selectedConfig = useMemo(
    () => configs.find((item) => item.id === selectedConfigId) ?? null,
    [configs, selectedConfigId],
  );

  function applyConfig(config: ModelConfigRecord | null) {
    if (!config) {
      setSelectedConfigId('');
      setName('默认模型配置');
      setBaseUrl('');
      setApiKey('');
      setDefaultModel('');
      setStatus('ACTIVE');
      setAvailableModels([]);
      setLastTestResult(null);
      return;
    }

    setSelectedConfigId(config.id);
    setName(config.name);
    setBaseUrl(config.baseUrl);
    setApiKey('');
    setDefaultModel(config.defaultModel ?? '');
    setStatus(config.status);
    setAvailableModels([]);
    setLastTestResult(null);
  }

  async function loadConfigs(preferredConfigId?: string) {
    const normalized = workspaceId.trim();
    if (!normalized) {
      applyConfig(null);
      setConfigs([]);
      return null;
    }

    setLoading(true);
    try {
      const items = await listModelConfigs(normalized);
      setConfigs(items);
      const preferred =
        items.find((item) => item.id === preferredConfigId) ??
        items.find((item) => item.id === selectedConfigId) ??
        pickPrimaryConfig(items);
      applyConfig(preferred ?? null);
      onSaved?.(preferred ?? null);
      return preferred ?? null;
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '加载模型配置失败');
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadConfigs();
  }, [open, workspaceId]);

  async function handleLoadModels() {
    if (selectedConfigId) {
      setLoadingModels(true);
      try {
        const result = await listModelConfigModels(selectedConfigId);
        setAvailableModels(result.models);
        messageApi.success(`已获取 ${result.modelCount} 个模型`);
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : '获取模型列表失败');
      } finally {
        setLoadingModels(false);
      }
      return;
    }

    if (!baseUrl.trim() || !apiKey.trim()) {
      messageApi.warning('请先填写 Base URL 和 API Key');
      return;
    }

    setLoadingModels(true);
    try {
      const result = await testDirectModelConnection({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
      });
      setAvailableModels(result.models);
      setLastTestResult(result);
      messageApi.success(`已获取 ${result.modelCount} 个模型`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '获取模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleTest() {
    if (selectedConfigId) {
      setTesting(true);
    try {
      const result = await testModelConfigConnection(selectedConfigId);
      setLastTestResult(result);
      setAvailableModels(result.models);
      if (result.ok) {
        messageApi.success('连接测试通过');
      } else {
        messageApi.warning('连接成功，但默认模型不可用');
      }
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : '测试连接失败');
      } finally {
        setTesting(false);
      }
      return;
    }

    if (!baseUrl.trim() || !apiKey.trim()) {
      messageApi.warning('请先填写 Base URL 和 API Key');
      return;
    }

    setTesting(true);
    try {
      const result = await testDirectModelConnection({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: defaultModel.trim() || undefined,
      });
      setLastTestResult(result);
      setAvailableModels(result.models);
      if (result.ok) {
        messageApi.success('连接测试通过');
      } else {
        messageApi.warning('接口可用，但模型名需要调整');
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '测试连接失败');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!workspaceId.trim()) {
      messageApi.warning('请先完成访问密钥校验并创建工作空间');
      return;
    }
    if (!name.trim() || !baseUrl.trim()) {
      messageApi.warning('请填写配置名称和 Base URL');
      return;
    }
    if (!selectedConfigId && !apiKey.trim()) {
      messageApi.warning('新建配置时必须填写 API Key');
      return;
    }

    setSaving(true);
    try {
      let saved: ModelConfigRecord;
      if (selectedConfigId) {
        saved = await updateModelConfig(selectedConfigId, {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim() || undefined,
          defaultModel: defaultModel.trim() || undefined,
          status,
        });
      } else {
        saved = await createModelConfig({
          workspaceId: workspaceId.trim(),
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          defaultModel: defaultModel.trim() || undefined,
          status,
        });
      }

      messageApi.success('模型配置已保存');
      await loadConfigs(saved.id);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '保存模型配置失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={760}
        className="model-config-modal"
        title="模型 / Base URL / API Key 配置"
        destroyOnHidden
      >
        <div className="model-config-panel">
          <div className="model-config-meta">
            <Text className="model-config-meta-title">当前工作空间</Text>
            <Text className="model-config-meta-value">
              {workspaceName?.trim() || workspaceId.trim() || '尚未创建 workspace'}
            </Text>
          </div>

          {!workspaceId.trim() && (
            <Alert
              className="model-config-alert"
              type="warning"
              showIcon
              message="请先输入访问密钥。首次进入时系统会创建真实 workspace，然后才能保存模型配置。"
            />
          )}

          <div className="model-config-section">
            <div className="model-config-section-head">
              <Text className="model-config-section-title">已保存配置</Text>
              <Button className="model-config-ghost-btn" onClick={() => applyConfig(null)}>
                新建配置
              </Button>
            </div>

            <div className="model-config-list">
              {configs.length === 0 && (
                <div className="model-config-empty">
                  <Text>当前 workspace 还没有保存任何模型配置。</Text>
                </div>
              )}

              {configs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`model-config-item ${item.id === selectedConfigId ? 'is-active' : ''}`}
                  onClick={() => applyConfig(item)}
                >
                  <div className="model-config-item-top">
                    <Text className="model-config-item-name">{item.name}</Text>
                    <Tag color={item.status === 'ACTIVE' ? 'success' : 'default'}>
                      {item.status === 'ACTIVE' ? '启用中' : '已停用'}
                    </Tag>
                  </div>
                  <Text className="model-config-item-desc">
                    {item.defaultModel || '未指定默认模型'} · {item.baseUrl}
                  </Text>
                  <Text className="model-config-item-desc">{item.apiKeyMasked}</Text>
                </button>
              ))}
            </div>
          </div>

          <div className="model-config-form-grid">
            <div className="model-config-field">
              <Text className="model-config-label">配置名称</Text>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="默认模型配置" />
            </div>

            <div className="model-config-field">
              <Text className="model-config-label">状态</Text>
              <div className="model-config-status-row">
                <Button
                  className={`model-config-status-btn ${status === 'ACTIVE' ? 'is-active' : ''}`}
                  onClick={() => setStatus('ACTIVE')}
                >
                  ACTIVE
                </Button>
                <Button
                  className={`model-config-status-btn ${status === 'DISABLED' ? 'is-active' : ''}`}
                  onClick={() => setStatus('DISABLED')}
                >
                  DISABLED
                </Button>
              </div>
            </div>

            <div className="model-config-field model-config-field-full">
              <Text className="model-config-label">Base URL</Text>
              <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" />
            </div>

            <div className="model-config-field model-config-field-full">
              <Text className="model-config-label">
                API Key
                {selectedConfig?.apiKeyMasked ? ` · 当前已保存 ${selectedConfig.apiKeyMasked}` : ''}
              </Text>
              <Input.Password
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={selectedConfig ? '留空则沿用当前已保存的 API Key' : 'sk-...'}
              />
            </div>

            <div className="model-config-field model-config-field-full">
              <Text className="model-config-label">默认模型</Text>
              <Input
                value={defaultModel}
                onChange={(event) => setDefaultModel(event.target.value)}
                placeholder="gpt-4.1 / deepseek-chat / qwen-max ..."
              />
            </div>
          </div>

          {availableModels.length > 0 && (
            <div className="model-config-models">
              <Text className="model-config-section-title">可用模型</Text>
              <div className="model-config-model-tags">
                {availableModels.slice(0, 18).map((model) => (
                  <button
                    key={model}
                    type="button"
                    className={`model-config-model-tag ${model === defaultModel ? 'is-active' : ''}`}
                    onClick={() => setDefaultModel(model)}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lastTestResult && (
            <Alert
              className="model-config-alert"
              type={lastTestResult.ok ? 'success' : 'warning'}
              showIcon
              message={lastTestResult.ok ? '连接通过，模型供应商接口可用。' : '接口可访问，但默认模型不可用或尚未填写。'}
              description={`返回 ${lastTestResult.modelCount} 个模型${lastTestResult.requestedModel ? `，当前默认模型：${lastTestResult.requestedModel}` : ''}`}
            />
          )}

          <Space className="model-config-actions" wrap>
            <Button className="model-config-outline-btn" onClick={() => void handleTest()} loading={testing}>
              测试连接
            </Button>
            <Button className="model-config-outline-btn" onClick={() => void handleLoadModels()} loading={loadingModels}>
              拉取模型列表
            </Button>
            <Button className="model-config-primary-btn" onClick={() => void handleSave()} loading={saving || loading}>
              保存配置
            </Button>
          </Space>
        </div>
      </Modal>
    </>
  );
}
