import { Injectable, Logger } from '@nestjs/common';
import { DiagnosisSeverity, ModelConfigStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type LlmProvider = {
  baseUrl: string;
  apiKey: string;
  model: string;
  source: 'workspace-config' | 'env-default';
};

type GenerateQuestionInput = {
  workspaceId: string;
  sessionTitle: string;
  targetRole?: string | null;
  techStack?: string | null;
  focus?: string;
  count: number;
  diagnosisItems: Array<{
    category: string;
    title: string;
    description: string;
    suggestion?: string | null;
  }>;
};

type EvaluateAnswerInput = {
  workspaceId: string;
  question: string;
  answer: string;
};

type GenerateDiagnosisInput = {
  workspaceId: string;
  targetRole?: string | null;
  targetLevel?: string | null;
  techStack?: string | null;
  businessDomain?: string | null;
  rawText: string;
  parsedData?: unknown;
  count: number;
  diagnosisFocus?: string;
  requiredCategories?: string[];
};

type PlanDiagnosisInput = {
  workspaceId: string;
  targetRole?: string | null;
  targetLevel?: string | null;
  techStack?: string | null;
  businessDomain?: string | null;
  rawText: string;
  parsedData?: unknown;
  count: number;
};

@Injectable()
export class OpenAICompatibleService {
  private readonly logger = new Logger(OpenAICompatibleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateInterviewQuestions(input: GenerateQuestionInput) {
    const provider = await this.resolveProvider(input.workspaceId);
    if (!provider) {
      return null;
    }

    const diagnosisSummary =
      input.diagnosisItems.length === 0
        ? '暂无诊断卡片'
        : input.diagnosisItems
            .slice(0, 8)
            .map(
              (item, index) =>
                `${index + 1}. [${item.category}] ${item.title} - ${item.description}${item.suggestion ? `；建议：${item.suggestion}` : ''}`,
            )
            .join('\n');

    const userPrompt = [
      `你是资深技术面试官，请基于以下上下文生成 ${input.count} 道高质量追问题。`,
      `会话标题：${input.sessionTitle}`,
      `目标岗位：${input.targetRole ?? '未指定'}`,
      `技术栈：${input.techStack ?? '未指定'}`,
      `本轮聚焦：${input.focus ?? '综合能力'}`,
      '诊断卡片：',
      diagnosisSummary,
      '输出要求：',
      '1) 只输出 JSON，不要输出任何解释文本。',
      '2) JSON 格式：{"questions":[{"question":"...","referenceAnswer":"..."}]}',
      '3) question 需要可追问、可验证，不要泛泛而谈。',
      '4) referenceAnswer 给出回答要点结构，不要写完整长答案。',
    ].join('\n');

    try {
      const payload = await this.chatCompletion(provider, [
        {
          role: 'system',
          content: '你是专业面试教练。输出必须是合法 JSON。',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      const json = this.extractJsonObject(payload);
      if (!json || !Array.isArray((json as { questions?: unknown[] }).questions)) {
        return null;
      }

      const questions = (json as { questions: Array<{ question?: string; referenceAnswer?: string }> }).questions
        .map((entry) => ({
          question: entry.question?.trim() ?? '',
          referenceAnswer: entry.referenceAnswer?.trim() ?? '',
        }))
        .filter((entry) => entry.question.length >= 8)
        .slice(0, input.count);

      if (questions.length === 0) {
        return null;
      }

      return questions;
    } catch (error) {
      this.logger.warn(`generateInterviewQuestions fallback: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async evaluateInterviewAnswer(input: EvaluateAnswerInput) {
    const provider = await this.resolveProvider(input.workspaceId);
    if (!provider) {
      return null;
    }

    const userPrompt = [
      '请对候选人的面试回答进行批改。',
      `问题：${input.question}`,
      `回答：${input.answer}`,
      '输出要求：',
      '1) 只输出 JSON。',
      '2) JSON 格式：{"score":0-100,"feedback":"...","followUpQuestion":"...","followUpHint":"..."}',
      '3) score 给出严格评分，feedback 不超过 120 字，followUpQuestion 可执行可深挖。',
    ].join('\n');

    try {
      const payload = await this.chatCompletion(provider, [
        {
          role: 'system',
          content: '你是严谨的技术面试官。输出必须为合法 JSON。',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      const json = this.extractJsonObject(payload);
      if (!json) {
        return null;
      }

      const parsed = json as {
        score?: unknown;
        feedback?: unknown;
        followUpQuestion?: unknown;
        followUpHint?: unknown;
      };

      if (typeof parsed.score !== 'number') {
        return null;
      }

      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        feedback: typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '',
        followUpQuestion: typeof parsed.followUpQuestion === 'string' ? parsed.followUpQuestion.trim() : '',
        followUpHint: typeof parsed.followUpHint === 'string' ? parsed.followUpHint.trim() : '',
      };
    } catch (error) {
      this.logger.warn(`evaluateInterviewAnswer fallback: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async generateDiagnosisItems(input: GenerateDiagnosisInput) {
    const provider = await this.resolveProvider(input.workspaceId);
    if (!provider) {
      return null;
    }

    const trimmedRaw = input.rawText.trim();
    const shortenedRaw = trimmedRaw.length > 5000 ? `${trimmedRaw.slice(0, 5000)}\n...[truncated]` : trimmedRaw;
    const parsedSnippet = input.parsedData ? JSON.stringify(input.parsedData).slice(0, 3200) : 'null';

    const requiredCategories = (input.requiredCategories ?? []).filter((value) => value.trim().length > 0);
    const userPrompt = [
      `你是资深面试官与简历顾问，请输出 ${input.count} 条高质量简历诊断项。`,
      `目标岗位：${input.targetRole ?? '未指定'}`,
      `目标级别：${input.targetLevel ?? '未指定'}`,
      `技术栈：${input.techStack ?? '未指定'}`,
      `业务方向：${input.businessDomain ?? '未指定'}`,
      `诊断聚焦：${input.diagnosisFocus ?? '综合评估'}`,
      `必须覆盖类别：${requiredCategories.length > 0 ? requiredCategories.join('、') : '至少覆盖指标与技术深度'}`,
      '原始简历文本：',
      shortenedRaw,
      '结构化简历片段：',
      parsedSnippet,
      '输出要求：',
      '1) 只输出 JSON。',
      '2) JSON 格式：{"items":[{"category":"...","severity":"LOW|MEDIUM|HIGH","title":"...","description":"...","suggestion":"..."}]}',
      '3) 项目必须可执行、可追问，description 控制在 120 字以内。',
      '4) 至少包含一条量化指标相关问题与一条技术深度相关问题。',
    ].join('\n');

    try {
      const payload = await this.chatCompletion(provider, [
        {
          role: 'system',
          content: '你是严谨的简历诊断专家。必须输出合法 JSON。',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      const json = this.extractJsonObject(payload);
      if (!json || !Array.isArray((json as { items?: unknown[] }).items)) {
        return null;
      }

      const items = (json as { items: Array<Record<string, unknown>> }).items
        .map((item) => {
          const severityText = typeof item.severity === 'string' ? item.severity.toUpperCase() : 'MEDIUM';
          const severity =
            severityText === 'HIGH'
              ? DiagnosisSeverity.HIGH
              : severityText === 'LOW'
                ? DiagnosisSeverity.LOW
                : DiagnosisSeverity.MEDIUM;

          return {
            category: typeof item.category === 'string' ? item.category.trim() : 'overall',
            severity,
            title: typeof item.title === 'string' ? item.title.trim() : '',
            description: typeof item.description === 'string' ? item.description.trim() : '',
            suggestion: typeof item.suggestion === 'string' ? item.suggestion.trim() : '',
          };
        })
        .filter((item) => item.title.length >= 4 && item.description.length >= 8)
        .slice(0, input.count);

      if (items.length === 0) {
        return null;
      }
      return items;
    } catch (error) {
      this.logger.warn(`generateDiagnosisItems fallback: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async planDiagnosisStrategy(input: PlanDiagnosisInput) {
    const provider = await this.resolveProvider(input.workspaceId);
    if (!provider) {
      return null;
    }

    const trimmedRaw = input.rawText.trim();
    const shortenedRaw = trimmedRaw.length > 3200 ? `${trimmedRaw.slice(0, 3200)}\n...[truncated]` : trimmedRaw;
    const parsedSnippet = input.parsedData ? JSON.stringify(input.parsedData).slice(0, 2200) : 'null';

    const userPrompt = [
      '你是简历诊断流程的调度 Agent，请先输出诊断策略规划。',
      `目标岗位：${input.targetRole ?? '未指定'}`,
      `目标级别：${input.targetLevel ?? '未指定'}`,
      `技术栈：${input.techStack ?? '未指定'}`,
      `业务方向：${input.businessDomain ?? '未指定'}`,
      `目标诊断条数：${input.count}`,
      '简历文本片段：',
      shortenedRaw,
      '结构化片段：',
      parsedSnippet,
      '输出要求：',
      '1) 只输出 JSON。',
      '2) JSON 格式：{"focusCategories":["..."],"strategy":"..."}',
      '3) focusCategories 只写英文小写短词（如 metrics, technical-depth, project-impact）。',
      '4) strategy 1-2 句话，说明本次诊断优先顺序和评估原则。',
    ].join('\n');

    try {
      const payload = await this.chatCompletion(provider, [
        {
          role: 'system',
          content: '你是简历诊断规划器。输出必须是合法 JSON。',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      const json = this.extractJsonObject(payload);
      if (!json) {
        return null;
      }

      const focusCategories = Array.isArray((json as { focusCategories?: unknown }).focusCategories)
        ? ((json as { focusCategories: unknown[] }).focusCategories
            .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
            .filter((value) => value.length > 0)
            .slice(0, 6) as string[])
        : [];
      const strategy =
        typeof (json as { strategy?: unknown }).strategy === 'string'
          ? (json as { strategy: string }).strategy.trim()
          : '';

      if (focusCategories.length === 0 && strategy.length === 0) {
        return null;
      }

      return {
        focusCategories,
        strategy,
      };
    } catch (error) {
      this.logger.warn(`planDiagnosisStrategy fallback: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async resolveProvider(workspaceId: string): Promise<LlmProvider | null> {
    const configured = await this.prisma.modelConfig.findFirst({
      where: {
        workspaceId,
        status: ModelConfigStatus.ACTIVE,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (configured && configured.defaultModel) {
      return {
        baseUrl: configured.baseUrl.trim().replace(/\/+$/, ''),
        apiKey: configured.apiKey,
        model: configured.defaultModel,
        source: 'workspace-config',
      };
    }

    const baseUrl = process.env.OPENAI_BASE_URL?.trim();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim();
    if (baseUrl && apiKey && model) {
      return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiKey,
        model,
        source: 'env-default',
      };
    }

    return null;
  }

  private async chatCompletion(
    provider: LlmProvider,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  ) {
    const endpoint = `${provider.baseUrl}/chat/completions`;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: 0.3,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`chat completion failed (${response.status}): ${text || response.statusText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('empty completion content');
      }

      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractJsonObject(content: string): Record<string, unknown> | null {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return null;
      }
      const maybe = content.slice(start, end + 1);
      try {
        return JSON.parse(maybe) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
}
