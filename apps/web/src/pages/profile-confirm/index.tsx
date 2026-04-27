import { CheckOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Input, Segmented, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelConfigModal } from '@/components/model-config-modal';
import { useWorkspaceModelConfig } from '@/hooks/use-workspace-model-config';
import type { ConfirmedResumeIntake } from '@/types/resume';
import './styles.less';

const { Title, Text } = Typography;

export function ProfileConfirmPage() {
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [draft, setDraft] = useState<ConfirmedResumeIntake | null>(null);
  const [role, setRole] = useState('');
  const [techStackText, setTechStackText] = useState('');
  const [level, setLevel] = useState('中级');
  const [domain, setDomain] = useState('');
  const [configOpen, setConfigOpen] = useState(false);

  const workspaceId = useMemo(() => localStorage.getItem('cv-review.workspaceId') ?? '', []);
  const workspaceName = useMemo(() => localStorage.getItem('cv-review.workspaceName') ?? '', []);
  const { activeConfig, reload: reloadActiveConfig } = useWorkspaceModelConfig(workspaceId);

  useEffect(() => {
    const stored = localStorage.getItem('cv-review.intake-draft');
    if (!stored) {
      void navigate('/intake', { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(stored) as ConfirmedResumeIntake;
      setDraft(parsed);
      setRole(parsed.role);
      setTechStackText(parsed.techStack);
      setLevel(parsed.level);
      setDomain(parsed.domain);
    } catch {
      void navigate('/intake', { replace: true });
    }
  }, [navigate]);

  const previewText = useMemo(() => {
    if (!draft) {
      return '';
    }

    const lines = [
      draft.role,
      '',
      `技能栈：${draft.techStack}`,
      '',
      draft.parsedData.projects[0]?.headline ?? draft.parsedData.experiences[0]?.headline ?? '',
      ...(draft.parsedData.projects[0]?.highlights ?? draft.parsedData.experiences[0]?.highlights ?? []).slice(0, 2),
    ].filter(Boolean);

    return lines.join('\n');
  }, [draft]);

  function handleConfirm() {
    if (!draft) {
      messageApi.warning('画像草稿尚未加载');
      return;
    }

    const techStackList = techStackText
      .split(/[，,、/|｜·；;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const nextPayload: ConfirmedResumeIntake = {
      ...draft,
      role: role.trim(),
      techStack: techStackList.join(' / '),
      techStackList,
      level: level.trim(),
      domain: domain.trim(),
    };

    localStorage.setItem('cv-review.intake', JSON.stringify(nextPayload));
    localStorage.setItem('cv-review.autostartBattlePack', '1');
    void navigate('/workspace');
  }

  if (!draft) {
    return null;
  }

  return (
    <div className="confirm-shell">
      {messageContextHolder}
      <div className="confirm-frame">
        <header className="confirm-top">
          <Text className="confirm-brand">CV Review / 新建作战包</Text>
          <Text className="confirm-step">步骤 2 / 2</Text>
        </header>

        <section className="confirm-main">
          <div className="confirm-evidence-panel">
            <div className="confirm-panel-head">
              <Title level={2} className="confirm-title">
                AI 已生成目标画像
              </Title>
              <Text className="confirm-desc">系统根据简历标题、技能栈和项目经历自动推断。你只需要确认关键字段，再进入完整工作台继续诊断。</Text>
            </div>

            <div className="confirm-step-strip">
              <Text className="confirm-step-chip is-done">1. 已导入简历</Text>
              <Text className="confirm-step-chip is-current">2. 确认目标画像</Text>
              <Text className="confirm-step-chip">3. 生成诊断与追问</Text>
            </div>

            <div className="confirm-confidence-card">
              <div className="confirm-confidence-badge">
                <ThunderboltOutlined />
                <span>画像置信度 {draft.confidence}%</span>
              </div>
              <Text className="confirm-confidence-desc">当前推断会作为后续诊断、改写和问答模块的上下文来源。</Text>
            </div>

            <div className="confirm-preview-card">
              <Text className="confirm-card-title">简历证据片段</Text>
              <pre className="confirm-preview-text">{previewText}</pre>
            </div>

            <div className="confirm-reason-box">
              <Text className="confirm-reason-title">为什么这样推断</Text>
              <Text className="confirm-reason-text">{draft.reasoning}</Text>
            </div>
          </div>

          <div className="confirm-profile-panel">
            <div className="confirm-panel-head">
              <Title level={3} className="confirm-card-title">
                确认目标画像
              </Title>
              <Text className="confirm-panel-desc">这里的岗位、技术栈、级别和业务方向会直接决定工作台里的诊断角度和追问路径。</Text>
            </div>

            <div className="confirm-config-card">
              <div>
                <Text className="confirm-config-title">当前模型配置</Text>
                <Text className="confirm-config-desc">
                  {activeConfig
                    ? `${activeConfig.defaultModel || '未设默认模型'} · ${activeConfig.baseUrl}`
                    : '尚未配置，进入工作台后将无法继续生成诊断和追问。'}
                </Text>
              </div>
              <Button className="confirm-config-btn" onClick={() => setConfigOpen(true)}>
                {activeConfig ? '修改' : '配置'}
              </Button>
            </div>

            <div className="confirm-field">
              <Text className="confirm-field-label">目标岗位</Text>
              <Input value={role} onChange={(event) => setRole(event.target.value)} className="confirm-input" />
            </div>

            <div className="confirm-field">
              <Text className="confirm-field-label">技术栈</Text>
              <Input value={techStackText} onChange={(event) => setTechStackText(event.target.value)} className="confirm-input" />
              <div className="confirm-tag-row">
                {techStackText
                  .split(/[，,、/|｜·；;]+/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
              </div>
            </div>

            <div className="confirm-field">
              <Text className="confirm-field-label">推断级别</Text>
              <Segmented
                block
                options={['初级', '中级', '资深']}
                value={level}
                onChange={(value) => setLevel(value as string)}
                className="confirm-level-segment"
              />
            </div>

            <div className="confirm-field">
              <Text className="confirm-field-label">业务方向</Text>
              <Input value={domain} onChange={(event) => setDomain(event.target.value)} className="confirm-input" />
            </div>

            <div className="confirm-actions">
              <Button className="confirm-primary-btn" block onClick={handleConfirm}>
                确认并进入工作台 <CheckOutlined />
              </Button>
              <Button className="confirm-secondary-btn" block onClick={() => void navigate('/intake')}>
                返回继续修改简历 <EditOutlined />
              </Button>
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
