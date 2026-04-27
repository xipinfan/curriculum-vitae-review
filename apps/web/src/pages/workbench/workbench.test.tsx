import { ConfigProvider } from 'antd';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchPage } from './index';

vi.mock('@/services/system', () => ({
  fetchHealth: vi.fn().mockResolvedValue({
    status: 'ok',
    service: 'cv-review-api',
    timestamp: '2026-04-26T00:00:00.000Z',
  }),
}));

vi.mock('@/services/diagnosis', () => ({
  listDiagnosisJobs: vi.fn().mockResolvedValue([]),
  getDiagnosisJob: vi.fn().mockResolvedValue(null),
  createDiagnosisJob: vi.fn(),
  startDiagnosisJob: vi.fn().mockResolvedValue({ started: true }),
  applyDiagnosisItemAction: vi.fn(),
}));

vi.mock('@/services/resumes', () => ({
  importResume: vi.fn(),
  parseResume: vi.fn(),
}));

vi.mock('@/services/sessions', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  createSession: vi.fn(),
  getSession: vi.fn(),
  getSessionReview: vi.fn(),
  getSessionReviewTrends: vi.fn(),
  generateSessionQuestions: vi.fn(),
  submitSessionAnswer: vi.fn(),
  getSessionProgress: vi.fn().mockResolvedValue({
    sessionId: 'session-1',
    totalRounds: 0,
    answeredRounds: 0,
    progressPercent: 0,
    averageScore: null,
  }),
}));

vi.mock('@/hooks/use-workspace-model-config', () => ({
  useWorkspaceModelConfig: vi.fn().mockReturnValue({
    activeConfig: {
      id: 'config-1',
      workspaceId: 'workspace-1',
      name: '默认模型配置',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyMasked: 'sk***123',
      defaultModel: 'gpt-4.1-compatible',
      status: 'ACTIVE',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
    },
    loading: false,
    reload: vi.fn(),
  }),
}));

describe('WorkbenchPage', () => {
  it('renders ant design x style ai workspace shell', async () => {
    render(
      <ConfigProvider>
        <WorkbenchPage />
      </ConfigProvider>,
    );

    expect(await screen.findByText('作战包')).toBeInTheDocument();
    expect(screen.getByText('AI 作战中枢')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('继续输入追问、改写或复盘指令')).toBeInTheDocument();
  });
});
