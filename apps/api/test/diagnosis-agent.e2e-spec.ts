import { DiagnosisSeverity } from '@prisma/client';
import { OpenAICompatibleService } from '../src/llm/openai-compatible.service';
import { DiagnosisAgentService } from '../src/diagnosis/diagnosis-agent.service';

describe('DiagnosisAgentService', () => {
  function createService(mock: {
    planDiagnosisStrategy: jest.Mock;
    generateDiagnosisItems: jest.Mock;
  }) {
    return new DiagnosisAgentService(mock as unknown as OpenAICompatibleService);
  }

  const fallbackItems = [
    {
      category: 'metrics',
      severity: DiagnosisSeverity.HIGH,
      title: '量化指标不足',
      description: '项目成果没有给出具体数字，难以证明真实效果。',
      suggestion: '补充吞吐、时延、成本或转化率等关键指标。',
    },
    {
      category: 'technical-depth',
      severity: DiagnosisSeverity.MEDIUM,
      title: '技术权衡描述不清',
      description: '没有说明为什么选择当前方案，也缺乏替代方案比较。',
      suggestion: '增加技术选型时的成本、复杂度和风险权衡。',
    },
    {
      category: 'project-impact',
      severity: DiagnosisSeverity.MEDIUM,
      title: '业务价值表达偏弱',
      description: '项目结果只停留在功能上线层面，缺少业务侧收益描述。',
      suggestion: '补充用户、收入或效率层面的实际影响。',
    },
  ];

  it('falls back to rule items when llm is unavailable', async () => {
    const mock = {
      planDiagnosisStrategy: jest.fn().mockResolvedValue(null),
      generateDiagnosisItems: jest.fn().mockResolvedValue(null),
    };
    const service = createService(mock);

    const result = await service.execute({
      workspaceId: 'ws-1',
      rawText: '简历文本',
      count: 2,
      fallbackItems,
    });

    expect(result.provider).toBe('rule-fallback');
    expect(result.items).toHaveLength(2);
    expect(result.steps.find((step) => step.id === 'generate')?.status).toBe('skipped');
    expect(mock.generateDiagnosisItems).toHaveBeenCalledTimes(1);
  });

  it('uses llm candidates and patches missing categories', async () => {
    const mock = {
      planDiagnosisStrategy: jest.fn().mockResolvedValue({
        focusCategories: ['metrics', 'technical-depth'],
        strategy: '优先核查指标与技术深度',
      }),
      generateDiagnosisItems: jest
        .fn()
        .mockResolvedValueOnce([
          {
            category: 'metrics',
            severity: DiagnosisSeverity.HIGH,
            title: '指标叙述不完整',
            description: '关键成果缺少基线和提升值，难以体现贡献强度。',
            suggestion: '补充优化前后对比值与业务指标关系。',
          },
        ])
        .mockResolvedValueOnce([
          {
            category: 'technical-depth',
            severity: DiagnosisSeverity.MEDIUM,
            title: '缺少技术深度证据',
            description: '当前描述未体现核心难点、方案权衡和关键实现细节。',
            suggestion: '增加架构图层、瓶颈定位和权衡决策说明。',
          },
        ]),
    };
    const service = createService(mock);
    const fallbackWithoutTechDepth = fallbackItems.filter((item) => !item.category.includes('technical-depth'));

    const result = await service.execute({
      workspaceId: 'ws-2',
      rawText: '简历文本',
      count: 3,
      fallbackItems: fallbackWithoutTechDepth,
    });

    expect(result.provider).toBe('llm-agent');
    expect(result.items).toHaveLength(3);
    expect(result.items.some((item) => item.category.includes('metrics'))).toBe(true);
    expect(result.items.some((item) => item.category.includes('technical-depth'))).toBe(true);
    expect(mock.generateDiagnosisItems).toHaveBeenCalledTimes(2);
    expect(result.steps.find((step) => step.id === 'cover')?.status).toBe('completed');
  });
});
