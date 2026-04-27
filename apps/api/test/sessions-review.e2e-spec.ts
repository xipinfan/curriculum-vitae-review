import { SessionStatus } from '@prisma/client';
import { OpenAICompatibleService } from '../src/llm/openai-compatible.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionsService } from '../src/sessions/sessions.service';

function createService(sessionPayload: unknown, sessionsPayload: unknown[] = []) {
  const prismaMock = {
    interviewSession: {
      findUnique: jest.fn().mockResolvedValue(sessionPayload),
      findMany: jest.fn().mockResolvedValue(sessionsPayload),
    },
  } as unknown as PrismaService;

  const llmMock = {} as OpenAICompatibleService;
  return new SessionsService(prismaMock, llmMock);
}

describe('SessionsService.getSessionReview', () => {
  it('returns READY when scores and diagnosis actions are strong', async () => {
    const service = createService({
      id: 'session-ready',
      workspaceId: 'workspace-1',
      title: '后端面试会话',
      status: SessionStatus.ACTIVE,
      rounds: [
        { question: '1. 讲一个性能优化案例', userAnswer: 'xxx', score: 90, feedback: '结构清晰' },
        { question: '2. 线上故障复盘', userAnswer: 'xxx', score: 88, feedback: '有指标' },
        { question: '3. 技术选型权衡', userAnswer: 'xxx', score: 86, feedback: '权衡完整' },
      ],
      diagnosis: {
        items: [
          { status: 'ADOPTED' },
          { status: 'MANUALLY_EDITED' },
          { status: 'IGNORED' },
        ],
      },
    });

    const review = await service.getSessionReview('session-ready');

    expect(review.readinessLevel).toBe('READY');
    expect(review.score.averageScore).toBe(88);
    expect(review.diagnosis.actionedRate).toBe(100);
  });

  it('returns RISK when low score and open diagnosis items remain', async () => {
    const service = createService({
      id: 'session-risk',
      workspaceId: 'workspace-2',
      title: '前端面试会话',
      status: SessionStatus.ACTIVE,
      rounds: [
        { question: '1. 渲染性能优化', userAnswer: 'xxx', score: 62, feedback: '缺少量化' },
        { question: '2. 工程质量保障', userAnswer: null, score: null, feedback: null },
      ],
      diagnosis: {
        items: [{ status: 'OPEN' }, { status: 'OPEN' }, { status: 'ADOPTED' }],
      },
    });

    const review = await service.getSessionReview('session-risk');

    expect(review.readinessLevel).toBe('RISK');
    expect(review.diagnosis.openItems).toBe(2);
    expect(review.nextActions.some((item) => item.priority === 'HIGH')).toBe(true);
  });
});

describe('SessionsService.getSessionReviewTrends', () => {
  it('groups trends by week and role', async () => {
    const service = createService(null, [
      {
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
        overallScore: 80,
        title: '后端面试训练',
        diagnosis: { targetRole: '后端开发工程师' },
        rounds: [
          { userAnswer: '回答A', score: 78 },
          { userAnswer: '回答B', score: 82 },
        ],
      },
      {
        createdAt: new Date('2026-04-10T08:00:00.000Z'),
        overallScore: 88,
        title: '后端面试训练',
        diagnosis: { targetRole: '后端开发工程师' },
        rounds: [
          { userAnswer: '回答A', score: 88 },
          { userAnswer: null, score: null },
        ],
      },
      {
        createdAt: new Date('2026-04-12T08:00:00.000Z'),
        overallScore: 72,
        title: '前端训练',
        diagnosis: { targetRole: '前端开发工程师' },
        rounds: [{ userAnswer: '回答X', score: 72 }],
      },
    ]);

    const trends = await service.getSessionReviewTrends('workspace-1', 12);

    expect(trends.workspaceId).toBe('workspace-1');
    expect(trends.byWeek.length).toBeGreaterThan(0);
    expect(trends.byRole.some((item) => item.role.includes('后端'))).toBe(true);
    expect(trends.byRole.some((item) => item.role.includes('前端'))).toBe(true);
  });
});
