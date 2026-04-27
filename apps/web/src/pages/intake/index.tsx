import { DeleteOutlined, StarOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Input, Segmented, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelConfigModal } from '@/components/model-config-modal';
import { useWorkspaceModelConfig } from '@/hooks/use-workspace-model-config';
import { importResume, parseResume } from '@/services/resumes';
import type { ConfirmedResumeIntake } from '@/types/resume';
import { inferProfileFromResume } from '@/utils/resume-profile';
import './styles.less';

const { Title, Text } = Typography;

const defaultResume = `张三｜后端开发工程师

项目经历
- 负责订单系统重构，提升接口稳定性。
- 使用 NestJS、Postgres、Redis 设计核心链路。
- 参与故障复盘和性能优化。

技能栈：TypeScript / Node.js / Docker / LangGraph`;

export function ResumeIntakePage() {
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [resumeContent, setResumeContent] = useState(defaultResume);
  const [role, setRole] = useState('后端开发工程师');
  const [techStack, setTechStack] = useState('NestJS / Postgres / Docker');
  const [level, setLevel] = useState('中级');
  const [domain, setDomain] = useState('电商交易 / B 端系统');
  const [workspaceName, setWorkspaceName] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const workspaceId = useMemo(() => localStorage.getItem('cv-review.workspaceId') ?? '', []);
  const { activeConfig, reload: reloadActiveConfig } = useWorkspaceModelConfig(workspaceId);

  useEffect(() => {
    setWorkspaceName(localStorage.getItem('cv-review.workspaceName') ?? '');
  }, []);

  async function handleStart() {
    if (!workspaceId.trim()) {
      messageApi.warning('请先返回上一页完成访问密钥校验');
      return;
    }
    if (resumeContent.trim().length < 20) {
      messageApi.warning('请先补充简历内容');
      return;
    }
    if (!activeConfig) {
      messageApi.warning('请先配置模型 / Base URL / API Key，再开始诊断');
      return;
    }

    setStarting(true);
    try {
      const imported = await importResume({
        workspaceId,
        sourceType: 'MARKDOWN',
        content: resumeContent.trim(),
      });
      const parsed = await parseResume(imported.id, { force: true });
      const inferred = inferProfileFromResume(parsed.parsedData, resumeContent.trim(), {
        role,
        techStack,
        level,
        domain,
      });

      const draft: ConfirmedResumeIntake = {
        workspaceId,
        workspaceName,
        resumeId: imported.id,
        resumeContent: resumeContent.trim(),
        parsedData: parsed.parsedData,
        role: inferred.role,
        techStack: inferred.techStack,
        techStackList: inferred.techStackList,
        level: inferred.level,
        domain: inferred.domain,
        confidence: inferred.confidence,
        reasoning: inferred.reasoning,
      };

      localStorage.setItem('cv-review.intake-draft', JSON.stringify(draft));
      void navigate('/confirm-profile');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '简历解析失败');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="intake-shell">
      {messageContextHolder}
      <div className="intake-frame">
        <header className="intake-top">
          <Text className="intake-brand">CV Review / 新建作战包</Text>
          <Text className="intake-step">步骤 1 / 2</Text>
        </header>

        <section className="intake-main">
          <div className="intake-resume-panel">
            <Title level={2} className="intake-panel-title">
              导入简历内容
            </Title>
            <Text className="intake-panel-desc">第一版优先支持粘贴文本或 Markdown；PDF / DOCX 作为辅助导入入口。</Text>

            <div className="intake-textarea-wrap">
              <div className="intake-textarea-head">
                <Text className="intake-textarea-label">Markdown / 纯文本</Text>
                <Text className="intake-textarea-count">{resumeContent.length.toLocaleString()} 字</Text>
              </div>
              <Input.TextArea
                value={resumeContent}
                onChange={(event) => setResumeContent(event.target.value)}
                autoSize={{ minRows: 14, maxRows: 18 }}
                variant="borderless"
              />
            </div>

            <div className="intake-actions">
              <Button icon={<UploadOutlined />} className="intake-btn-muted">
                上传 PDF / DOCX
              </Button>
              <Button
                icon={<DeleteOutlined />}
                className="intake-btn-outline"
                onClick={() => {
                  setResumeContent('');
                }}
              >
                清空
              </Button>
            </div>
          </div>

          <div className="intake-target-panel">
            <Title level={3} className="intake-target-title">
              AI 识别目标画像
            </Title>
            <Text className="intake-target-desc">导入简历后自动抽取岗位、技术栈、级别和业务方向，用户只需要确认或修正。</Text>

            <div className="intake-config-card">
              <div>
                <Text className="intake-config-title">当前模型配置</Text>
                <Text className="intake-config-desc">
                  {activeConfig
                    ? `${activeConfig.defaultModel || '未设默认模型'} · ${activeConfig.baseUrl}`
                    : '尚未配置，继续执行会落回默认模型。'}
                </Text>
              </div>
              <Button className="intake-config-btn" onClick={() => setConfigOpen(true)}>
                {activeConfig ? '修改' : '配置'}
              </Button>
            </div>

            <div className="intake-field">
              <Text className="intake-field-label">识别岗位</Text>
              <Input value={role} onChange={(event) => setRole(event.target.value)} className="intake-field-input" />
            </div>
            <div className="intake-field">
              <Text className="intake-field-label">识别技术栈</Text>
              <Input value={techStack} onChange={(event) => setTechStack(event.target.value)} className="intake-field-input" />
            </div>
            <div className="intake-field">
              <Text className="intake-field-label">推断级别</Text>
              <Segmented
                block
                options={['初级', '中级', '资深']}
                value={level}
                onChange={(value) => setLevel(value as string)}
                className="intake-level-segment"
              />
            </div>
            <div className="intake-field">
              <Text className="intake-field-label">推断业务方向</Text>
              <Input value={domain} onChange={(event) => setDomain(event.target.value)} className="intake-field-input" />
            </div>

            <Button className="intake-start-btn" block onClick={() => void handleStart()} loading={starting}>
              继续确认画像 <StarOutlined />
            </Button>
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
