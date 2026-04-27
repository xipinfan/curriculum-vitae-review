import { CompassOutlined } from '@ant-design/icons';
import { Bubble, Conversations, Prompts, Sender, Welcome } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import { Empty, Tag, Typography } from 'antd';
import type { BubbleItemType, ConversationItemType, PromptsProps } from '@ant-design/x';
import './styles.less';

const { Text } = Typography;

export type WorkspaceAiConversationItem = Pick<ConversationItemType, 'key' | 'label' | 'group' | 'icon' | 'disabled'>;

export type WorkspaceAiMessage = {
  key: string;
  role: 'ai' | 'user' | 'system';
  title?: string;
  status?: BubbleItemType['status'];
  content: string;
};

type WorkspaceAiPanelProps = {
  moduleTitle: string;
  moduleSubtitle: string;
  moduleStatus?: string;
  conversations: WorkspaceAiConversationItem[];
  activeConversationKey?: string;
  onConversationChange?: (key: string) => void;
  messages: WorkspaceAiMessage[];
  senderValue: string;
  senderPlaceholder: string;
  senderLoading?: boolean;
  senderDisabled?: boolean;
  onSenderChange: (value: string) => void;
  onSenderSubmit: () => void;
  promptItems?: PromptsProps['items'];
  promptLabel?: string;
  onPromptSelect?: (key: string) => void;
};

function renderMarkdown(content: string) {
  return (
    <XMarkdown
      className="workspace-ai-markdown"
      content={content}
      openLinksInNewTab
      escapeRawHtml
    />
  );
}

export function WorkspaceAiPanel({
  moduleTitle,
  moduleSubtitle,
  moduleStatus,
  conversations,
  activeConversationKey,
  onConversationChange,
  messages,
  senderValue,
  senderPlaceholder,
  senderLoading,
  senderDisabled,
  onSenderChange,
  onSenderSubmit,
  promptItems,
  promptLabel,
  onPromptSelect,
}: WorkspaceAiPanelProps) {
  const bubbleItems: BubbleItemType[] = messages.map((message) => ({
    key: message.key,
    role: message.role,
    header: message.title ? <Text className="workspace-ai-panel__bubble-title">{message.title}</Text> : undefined,
    content: renderMarkdown(message.content),
    status: message.status,
  }));

  return (
    <section className="workspace-ai-panel">
      <aside className="workspace-ai-panel__sidebar">
        <div className="workspace-ai-panel__sidebar-head">
          <Text className="workspace-ai-panel__sidebar-title">AI 视角导航</Text>
          <Text className="workspace-ai-panel__sidebar-hint">按当前模块切换要点、问题和会话。</Text>
        </div>

        {conversations.length > 0 ? (
          <Conversations
            items={conversations}
            activeKey={activeConversationKey}
            onActiveChange={(value) => onConversationChange?.(String(value))}
            groupable
            className="workspace-ai-panel__conversations"
          />
        ) : (
          <div className="workspace-ai-panel__empty-nav">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有可切换的 AI 上下文" />
          </div>
        )}
      </aside>

      <div className="workspace-ai-panel__main">
        <Welcome
          className="workspace-ai-panel__welcome"
          variant="filled"
          icon={<CompassOutlined />}
          title="AI 作战中枢"
          description={moduleSubtitle}
          extra={
            <div className="workspace-ai-panel__welcome-extra">
              <Tag color="orange">{moduleTitle}</Tag>
              {moduleStatus ? <Tag>{moduleStatus}</Tag> : null}
            </div>
          }
        />

        {promptItems && promptItems.length > 0 ? (
          <div className="workspace-ai-panel__prompts">
            <Text className="workspace-ai-panel__prompts-title">{promptLabel ?? '快捷动作'}</Text>
            <Prompts
              items={promptItems}
              onItemClick={(info) => {
                const key = typeof info.data?.key === 'string' ? info.data.key : '';
                if (key) {
                  onPromptSelect?.(key);
                }
              }}
            />
          </div>
        ) : null}

        <div className="workspace-ai-panel__bubble-wrap">
          <Bubble.List
            autoScroll
            items={bubbleItems}
            role={{
              ai: {
                placement: 'start',
                variant: 'filled',
                shape: 'round',
              },
              user: {
                placement: 'end',
                variant: 'shadow',
                shape: 'round',
              },
              system: {
                placement: 'start',
                variant: 'borderless',
                shape: 'corner',
              },
            }}
          />
        </div>

        <Sender
          value={senderValue}
          loading={senderLoading}
          disabled={senderDisabled}
          placeholder={senderPlaceholder}
          onChange={(value) => onSenderChange(value)}
          onSubmit={() => onSenderSubmit()}
          className="workspace-ai-panel__sender"
          autoSize={false}
        />
      </div>
    </section>
  );
}
