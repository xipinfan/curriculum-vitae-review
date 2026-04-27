import { Injectable } from '@nestjs/common';
import { DiagnosisSeverity } from '@prisma/client';
import { OpenAICompatibleService } from '../llm/openai-compatible.service';

type AgentSource = 'llm' | 'rule';

type AgentItem = {
  category: string;
  severity: DiagnosisSeverity;
  title: string;
  description: string;
  suggestion: string;
  source: AgentSource;
};

export type DiagnosisAgentInput = {
  workspaceId: string;
  targetRole?: string | null;
  targetLevel?: string | null;
  techStack?: string | null;
  businessDomain?: string | null;
  rawText: string;
  parsedData?: unknown;
  count: number;
  fallbackItems: Array<{
    category: string;
    severity: DiagnosisSeverity;
    title: string;
    description: string;
    suggestion: string;
  }>;
};

export type DiagnosisAgentStepStatus = 'completed' | 'skipped' | 'failed';

export type DiagnosisAgentStep = {
  id: string;
  title: string;
  status: DiagnosisAgentStepStatus;
  detail: string;
  itemCount?: number;
  durationMs: number;
};

export type DiagnosisAgentProgress = {
  stepId: string;
  stepTitle: string;
  phase: 'running' | DiagnosisAgentStepStatus;
  progress: number;
  message: string;
  itemCount?: number;
};

export type DiagnosisAgentResult = {
  items: Array<{
    category: string;
    severity: DiagnosisSeverity;
    title: string;
    description: string;
    suggestion: string;
  }>;
  provider: 'llm-agent' | 'rule-fallback';
  steps: DiagnosisAgentStep[];
};

type DiagnosisPlan = {
  focusCategories: string[];
  strategy: string;
};

@Injectable()
export class DiagnosisAgentService {
  constructor(private readonly openAICompatibleService: OpenAICompatibleService) {}

  async execute(input: DiagnosisAgentInput, onProgress?: (progress: DiagnosisAgentProgress) => void): Promise<DiagnosisAgentResult> {
    const steps: DiagnosisAgentStep[] = [];
    const fallbackItems = this.normalizeItems(input.fallbackItems, 'rule');
    const effectiveFallback = fallbackItems.length > 0 ? fallbackItems : [this.defaultFallbackItem()];
    let candidates: AgentItem[] = [...effectiveFallback];
    let finalItems: AgentItem[] = [];
    let provider: 'llm-agent' | 'rule-fallback' = 'rule-fallback';

    const progressMap = {
      plan: 34,
      generate: 50,
      cover: 68,
      rank: 84,
    } as const;

    const plan = await this.runStep(
      steps,
      {
        id: 'plan',
        title: 'agent planning',
        progress: progressMap.plan,
      },
      async () => {
        const llmPlan = await this.openAICompatibleService.planDiagnosisStrategy({
          workspaceId: input.workspaceId,
          targetRole: input.targetRole,
          targetLevel: input.targetLevel,
          techStack: input.techStack,
          businessDomain: input.businessDomain,
          rawText: input.rawText,
          parsedData: input.parsedData,
          count: input.count,
        });

        if (llmPlan) {
          return {
            detail: `planner focused on ${llmPlan.focusCategories.join(', ') || 'overall structure'}`,
            value: this.normalizePlan(llmPlan),
          };
        }

        return {
          status: 'skipped' as const,
          detail: 'llm planner unavailable, fallback to default plan',
          value: this.defaultPlan(input),
        };
      },
      onProgress,
    );

    await this.runStep(
      steps,
      {
        id: 'generate',
        title: 'candidate generation',
        progress: progressMap.generate,
      },
      async () => {
        const llmGenerated = await this.openAICompatibleService.generateDiagnosisItems({
          workspaceId: input.workspaceId,
          targetRole: input.targetRole,
          targetLevel: input.targetLevel,
          techStack: input.techStack,
          businessDomain: input.businessDomain,
          rawText: input.rawText,
          parsedData: input.parsedData,
          count: Math.max(input.count + 2, input.count * 2),
          diagnosisFocus: plan.strategy,
          requiredCategories: plan.focusCategories,
        });

        const normalizedLlm = this.normalizeItems(llmGenerated ?? [], 'llm');
        if (normalizedLlm.length > 0) {
          provider = 'llm-agent';
          candidates = this.mergeUnique(normalizedLlm, effectiveFallback);
          return {
            detail: `llm generated ${normalizedLlm.length} candidate items`,
            itemCount: candidates.length,
          };
        }

        candidates = [...effectiveFallback];
        return {
          status: 'skipped' as const,
          detail: 'llm output unavailable, using rule fallback',
          itemCount: candidates.length,
        };
      },
      onProgress,
    );

    await this.runStep(
      steps,
      {
        id: 'cover',
        title: 'coverage guard',
        progress: progressMap.cover,
      },
      async () => {
        const requiredCategories = this.requiredCategories(plan.focusCategories);
        const missing = requiredCategories.filter((category) => !this.hasCategory(candidates, category));
        if (missing.length === 0) {
          return {
            status: 'skipped' as const,
            detail: 'coverage already satisfied',
            itemCount: candidates.length,
          };
        }

        const patches: AgentItem[] = [];
        if (provider === 'llm-agent') {
          const patched = await this.openAICompatibleService.generateDiagnosisItems({
            workspaceId: input.workspaceId,
            targetRole: input.targetRole,
            targetLevel: input.targetLevel,
            techStack: input.techStack,
            businessDomain: input.businessDomain,
            rawText: input.rawText,
            parsedData: input.parsedData,
            count: Math.min(input.count, Math.max(missing.length + 1, 2)),
            diagnosisFocus: `重点补齐以下诊断类别：${missing.join('、')}`,
            requiredCategories: missing,
          });
          patches.push(...this.normalizeItems(patched ?? [], 'llm'));
        }

        if (patches.length === 0) {
          patches.push(...this.pickFallbackByCategories(effectiveFallback, missing));
        }

        candidates = this.mergeUnique(candidates, patches);
        const unresolved = requiredCategories.filter((category) => !this.hasCategory(candidates, category));

        return {
          detail:
            unresolved.length > 0
              ? `coverage partially repaired, unresolved: ${unresolved.join(', ')}`
              : 'coverage repaired',
          itemCount: candidates.length,
        };
      },
      onProgress,
    );

    await this.runStep(
      steps,
      {
        id: 'rank',
        title: 'ranking and finalize',
        progress: progressMap.rank,
      },
      async () => {
        finalItems = this.rankAndSelect(candidates, input.count);
        if (finalItems.length === 0) {
          finalItems = this.rankAndSelect(effectiveFallback, input.count);
          provider = 'rule-fallback';
        }
        return {
          detail: `finalized ${finalItems.length} diagnosis items`,
          itemCount: finalItems.length,
        };
      },
      onProgress,
    );

    return {
      items: finalItems.map((item) => ({
        category: item.category,
        severity: item.severity,
        title: item.title,
        description: item.description,
        suggestion: item.suggestion,
      })),
      provider,
      steps,
    };
  }

  private async runStep<T>(
    traces: DiagnosisAgentStep[],
    step: { id: string; title: string; progress: number },
    handler: () => Promise<{
      status?: DiagnosisAgentStepStatus;
      detail: string;
      itemCount?: number;
      value?: T;
    }>,
    onProgress?: (progress: DiagnosisAgentProgress) => void,
  ): Promise<T> {
    const startedAt = Date.now();
    onProgress?.({
      stepId: step.id,
      stepTitle: step.title,
      phase: 'running',
      progress: Math.max(20, step.progress - 4),
      message: step.title,
    });

    try {
      const result = await handler();
      const status = result.status ?? 'completed';
      traces.push({
        id: step.id,
        title: step.title,
        status,
        detail: result.detail,
        itemCount: result.itemCount,
        durationMs: Date.now() - startedAt,
      });
      onProgress?.({
        stepId: step.id,
        stepTitle: step.title,
        phase: status,
        progress: step.progress,
        message: result.detail,
        itemCount: result.itemCount,
      });
      return result.value as T;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown step failure';
      traces.push({
        id: step.id,
        title: step.title,
        status: 'failed',
        detail,
        durationMs: Date.now() - startedAt,
      });
      onProgress?.({
        stepId: step.id,
        stepTitle: step.title,
        phase: 'failed',
        progress: step.progress,
        message: detail,
      });
      throw error;
    }
  }

  private normalizePlan(plan: DiagnosisPlan): DiagnosisPlan {
    const categories = (plan.focusCategories ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);
    const dedupedCategories = [...new Set(categories)];

    return {
      focusCategories: dedupedCategories.length > 0 ? dedupedCategories : this.defaultPlan({}).focusCategories,
      strategy: plan.strategy?.trim() || this.defaultPlan({}).strategy,
    };
  }

  private defaultPlan(input: Partial<DiagnosisAgentInput>): DiagnosisPlan {
    const categories = ['metrics', 'technical-depth', 'project-impact'];
    if (input.targetRole?.toLowerCase().includes('manager')) {
      categories.push('leadership');
    }
    if (input.techStack?.toLowerCase().includes('frontend')) {
      categories.push('engineering-quality');
    }
    return {
      focusCategories: [...new Set(categories)],
      strategy: `围绕${input.targetRole ?? '目标岗位'}验证指标可信度、技术决策深度和项目业务价值。`,
    };
  }

  private requiredCategories(planCategories: string[]) {
    const baseline = ['metrics', 'technical-depth'];
    const merged = [...baseline, ...planCategories];
    return [...new Set(merged.map((value) => value.toLowerCase()))];
  }

  private normalizeItems(
    items: Array<{
      category: string;
      severity: DiagnosisSeverity;
      title: string;
      description: string;
      suggestion: string;
    }>,
    source: AgentSource,
  ) {
    return items
      .map((item) => {
        const title = item.title?.trim() ?? '';
        const description = item.description?.trim() ?? '';
        if (title.length < 4 || description.length < 8) {
          return null;
        }

        return {
          category: (item.category?.trim() || 'overall').toLowerCase(),
          severity: item.severity ?? DiagnosisSeverity.MEDIUM,
          title,
          description: description.slice(0, 160),
          suggestion: item.suggestion?.trim() ?? '',
          source,
        } as AgentItem;
      })
      .filter((item): item is AgentItem => Boolean(item));
  }

  private mergeUnique(...groups: AgentItem[][]) {
    const map = new Map<string, AgentItem>();
    for (const group of groups) {
      for (const item of group) {
        const key = `${item.category}::${item.title.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
    }
    return Array.from(map.values());
  }

  private hasCategory(items: AgentItem[], expected: string) {
    const normalizedExpected = expected.toLowerCase();
    return items.some((item) => item.category.toLowerCase().includes(normalizedExpected));
  }

  private pickFallbackByCategories(items: AgentItem[], categories: string[]) {
    const selected: AgentItem[] = [];
    for (const category of categories) {
      const matched = items.find((item) => item.category.toLowerCase().includes(category.toLowerCase()));
      if (matched) {
        selected.push(matched);
      }
    }
    return selected;
  }

  private rankAndSelect(items: AgentItem[], count: number) {
    const ranked = [...items]
      .map((item) => ({
        ...item,
        score:
          (item.severity === DiagnosisSeverity.HIGH ? 80 : item.severity === DiagnosisSeverity.MEDIUM ? 50 : 25) +
          (item.source === 'llm' ? 8 : 0) +
          Math.min(8, Math.floor(item.description.length / 30)),
      }))
      .sort((left, right) => right.score - left.score);

    const selected: AgentItem[] = [];
    const usedCategories = new Set<string>();
    for (const item of ranked) {
      if (selected.length >= count) {
        break;
      }
      const categoryKey = item.category.toLowerCase();
      if (!usedCategories.has(categoryKey) || selected.length + 1 === count) {
        selected.push(item);
        usedCategories.add(categoryKey);
      }
    }

    if (selected.length < count) {
      for (const item of ranked) {
        if (selected.length >= count) {
          break;
        }
        if (!selected.some((entry) => entry.title === item.title && entry.category === item.category)) {
          selected.push(item);
        }
      }
    }

    return selected.slice(0, count);
  }

  private defaultFallbackItem(): AgentItem {
    return {
      category: 'overall',
      severity: DiagnosisSeverity.MEDIUM,
      title: '建议补充可量化且可追问的项目叙述',
      description: '当前诊断素材不足，建议先补充项目背景、技术决策与结果指标，再继续自动诊断。',
      suggestion: '每个核心项目至少补充 1 条业务指标与 1 条技术权衡细节。',
      source: 'rule',
    };
  }
}
