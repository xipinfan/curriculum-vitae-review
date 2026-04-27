# Ant Design X Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `/workspace` AI workbench to use `@ant-design/x` and `@ant-design/x-markdown` while preserving existing diagnosis, QA, and review data flows.

**Architecture:** Keep the current route and service orchestration in `WorkbenchPage`, but extract a focused AI interaction panel that renders module conversations, welcome state, markdown-rich assistant output, and a unified sender area with Ant Design X primitives. Leave access, intake, and profile-confirm pages on plain Ant Design.

**Tech Stack:** React, Vite, Ant Design, Ant Design X, Ant Design X Markdown, Vitest, Less

---

### Task 1: Add failing workspace expectations and install AI UI dependencies

**Files:**
- Modify: `apps/web/src/pages/workbench/workbench.test.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByText('AI 作战中枢')).toBeInTheDocument();
expect(screen.getByPlaceholderText('继续输入追问、改写或复盘指令')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cv-review/web exec vitest run src/pages/workbench/workbench.test.tsx`
Expected: FAIL because the workspace still renders the old custom shell only.

- [ ] **Step 3: Install minimal AI UI dependencies**

```bash
pnpm --filter @cv-review/web add @ant-design/x @ant-design/x-markdown
```

- [ ] **Step 4: Re-run the same test and keep it failing for the same feature gap**

Run: `pnpm --filter @cv-review/web exec vitest run src/pages/workbench/workbench.test.tsx`
Expected: FAIL on the same missing UI expectations, proving dependency installation did not satisfy behavior.

### Task 2: Build a focused Ant Design X workspace panel

**Files:**
- Create: `apps/web/src/components/workspace-ai-panel/index.tsx`
- Create: `apps/web/src/components/workspace-ai-panel/styles.less`
- Test: `apps/web/src/pages/workbench/workbench.test.tsx`

- [ ] **Step 1: Implement the new panel with explicit props**

```tsx
type WorkspaceAiPanelProps = {
  moduleTitle: string;
  moduleSubtitle: string;
  conversationItems: Array<{ key: string; label: string }>;
  activeConversationKey: string;
  onConversationChange: (key: string) => void;
  messages: Array<{ key: string; role: 'assistant' | 'user'; title?: string; content: string }>;
  senderValue: string;
  senderPlaceholder: string;
  onSenderChange: (value: string) => void;
  onSenderSubmit: () => void;
  loading?: boolean;
};
```

- [ ] **Step 2: Render Ant Design X primitives only for the AI zone**

```tsx
<Welcome title="AI 作战中枢" description={moduleSubtitle} />
<Conversations items={conversationItems} activeKey={activeConversationKey} onActiveChange={onConversationChange} />
<Bubble.List items={bubbleItems} />
<Sender value={senderValue} placeholder={senderPlaceholder} onChange={setValue} onSubmit={onSenderSubmit} />
```

- [ ] **Step 3: Render assistant content through markdown**

```tsx
import { XMarkdown } from '@ant-design/x-markdown';

content: <XMarkdown>{message.content}</XMarkdown>
```

- [ ] **Step 4: Keep the failing test green-focused**

Run: `pnpm --filter @cv-review/web exec vitest run src/pages/workbench/workbench.test.tsx`
Expected: PASS once the new panel is mounted and exposes the welcome title and sender placeholder.

### Task 3: Integrate the panel into WorkbenchPage and verify the app

**Files:**
- Modify: `apps/web/src/pages/workbench/index.tsx`
- Modify: `apps/web/src/pages/workbench/styles.less`
- Modify: `README.md`

- [ ] **Step 1: Build module-specific conversations and markdown messages from existing view models**

```tsx
const aiMessages = buildWorkspaceMessages({
  selectedModule,
  diagnosisViewModel,
  activeOptimizeItem,
  activeQaRound,
  qaFixSuggestions,
  reviewTasks,
  reviewPlanText,
});
```

- [ ] **Step 2: Connect the unified sender to existing handlers**

```tsx
const handleAiSubmit = () => {
  if (selectedModule === 'qa' && activeQaRound) {
    void handleSubmitAnswer(activeQaRound);
    return;
  }
  if (selectedModule === 'diagnosis') {
    void handleStartDiagnosis();
    return;
  }
  if (selectedModule === 'review') {
    void loadSessionReview();
  }
};
```

- [ ] **Step 3: Update styling so the new panel coexists with the current visual draft**

```less
.workspace-ai-panel {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
}
```

- [ ] **Step 4: Correct the README stack description**

```md
- AI 交互：Ant Design X（workspace AI 面板）
- Markdown 渲染：Ant Design X Markdown
```

- [ ] **Step 5: Run verification**

Run:

```bash
pnpm --filter @cv-review/web exec vitest run src/pages/workbench/workbench.test.tsx
pnpm --filter @cv-review/web build
```

Expected: both commands exit 0.

- [ ] **Step 6: Run browser verification on `http://localhost:5173/workspace`**

Expected:
- Welcome 区显示 `AI 作战中枢`
- 右侧有统一 Sender 输入区
- 模块切换后消息区随诊断/问答/复盘数据变化
