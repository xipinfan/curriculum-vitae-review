import { ArrowLeftOutlined, CheckOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Input, Segmented, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        <aside className="confirm-side">
          <Text className="confirm-side-brand">作战包 / 初始化</Text>

          <div className="confirm-step-box">
            <Text className="confirm-step-title">初始化进度</Text>
            <Text className="confirm-step-item is-done">✓ 已导入简历</Text>
            <Text className="confirm-step-item is-current">● 确认目标画像</Text>
            <Text className="confirm-step-item">○ 生成诊断</Text>
          </div>
        </aside>

        <main className="confirm-main">
          <header className="confirm-header">
            <div className="confirm-header-text">
              <Title level={2} className="confirm-title">
                AI 已生成目标画像
              </Title>
              <Text className="confirm-desc">系统根据简历标题、技能栈和项目经历自动推断。你可以直接确认，也可以只修改有偏差的字段。</Text>
            </div>

            <div className="confirm-confidence">
              <ThunderboltOutlined />
              <span>画像置信度 {draft.confidence}%</span>
            </div>
          </header>

          <section className="confirm-columns">
            <div className="confirm-preview-card">
              <Text className="confirm-card-title">简历证据片段</Text>
              <pre className="confirm-preview-text">{previewText}</pre>
            </div>

            <div className="confirm-profile-card">
              <Text className="confirm-card-title">待确认画像</Text>

              <div className="confirm-field">
                <Text className="confirm-field-label">目标岗位</Text>
                <Input value={role} onChange={(event) => setRole(event.target.value)} className="confirm-input" />
              </div>

              <div className="confirm-field">
                <Text className="confirm-field-label">技术栈</Text>
                <Input
                  value={techStackText}
                  onChange={(event) => setTechStackText(event.target.value)}
                  className="confirm-input"
                />
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

              <div className="confirm-reason-box">
                <Text className="confirm-reason-title">为什么这样推断</Text>
                <Text className="confirm-reason-text">{draft.reasoning}</Text>
              </div>

              <div className="confirm-actions">
                <Button className="confirm-primary-btn" block onClick={handleConfirm}>
                  确认并生成诊断 <CheckOutlined />
                </Button>
                <Button className="confirm-secondary-btn" block onClick={() => void navigate('/intake')}>
                  返回继续修改简历 <EditOutlined />
                </Button>
                <Button className="confirm-ghost-btn" block onClick={() => void navigate('/intake')}>
                  <ArrowLeftOutlined /> 返回上一步
                </Button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
