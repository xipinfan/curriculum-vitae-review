import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { OpenAICompatibleService } from '../llm/openai-compatible.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionRoundDto } from './dto/create-session-round.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { GenerateSessionQuestionsDto } from './dto/generate-session-questions.dto';
import { SubmitSessionAnswerDto } from './dto/submit-session-answer.dto';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAICompatibleService: OpenAICompatibleService,
  ) {}

  listSessionsByWorkspace(workspaceId: string) {
    return this.prisma.interviewSession.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { rounds: true },
        },
      },
    });
  }

  createSession(input: CreateSessionDto) {
    return this.prisma.interviewSession.create({
      data: {
        workspaceId: input.workspaceId,
        diagnosisJobId: input.diagnosisJobId,
        title: input.title,
        status: input.status,
      },
    });
  }

  async generateQuestions(sessionId: string, input: GenerateSessionQuestionsDto) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        diagnosis: {
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('session not found');
    }

    const count = input.count ?? 5;
    const focus = input.focus?.trim();
    const llmQuestions = await this.openAICompatibleService.generateInterviewQuestions({
      workspaceId: session.workspaceId,
      sessionTitle: session.title,
      targetRole: session.diagnosis?.targetRole,
      techStack: session.diagnosis?.techStack,
      focus,
      count,
      diagnosisItems: (session.diagnosis?.items ?? []).map((item) => ({
        category: item.category,
        title: item.title,
        description: item.description,
        suggestion: item.suggestion,
      })),
    });

    const seeds = this.buildQuestionSeeds(session, focus);
    const rounds = await this.prisma.$transaction(async (tx) => {
      const created: Array<{ id: string; question: string; referenceAnswer: string | null }> = [];
      for (let index = 0; index < count; index += 1) {
        const llm = llmQuestions?.[index];
        const seed = seeds[index % seeds.length];
        const question = llm?.question
          ? `${index + 1}. ${llm.question}`
          : this.renderQuestion(seed, index + 1, focus);
        const referenceAnswer = llm?.referenceAnswer ? llm.referenceAnswer : this.renderReferenceAnswer(seed);
        const round = await tx.sessionRound.create({
          data: {
            sessionId,
            question,
            referenceAnswer,
          },
          select: {
            id: true,
            question: true,
            referenceAnswer: true,
          },
        });
        created.push(round);
      }

      await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.ACTIVE,
        },
      });

      return created;
    });

    return {
      sessionId,
      generatedCount: rounds.length,
      rounds,
    };
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        rounds: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('session not found');
    }

    return session;
  }

  async updateSessionStatus(sessionId: string, input: UpdateSessionStatusDto) {
    await this.ensureSession(sessionId);
    return this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: input.status,
        overallScore: input.overallScore,
      },
    });
  }

  async listRounds(sessionId: string) {
    await this.ensureSession(sessionId);
    return this.prisma.sessionRound.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRound(sessionId: string, input: CreateSessionRoundDto) {
    await this.ensureSession(sessionId);

    return this.prisma.sessionRound.create({
      data: {
        sessionId,
        question: input.question,
        referenceAnswer: input.referenceAnswer,
        userAnswer: input.userAnswer,
        feedback: input.feedback,
        score: input.score,
        followUpQuestion: input.followUpQuestion,
      },
    });
  }

  async submitAnswer(sessionId: string, roundId: string, input: SubmitSessionAnswerDto) {
    const round = await this.prisma.sessionRound.findFirst({
      where: {
        id: roundId,
        sessionId,
      },
    });
    if (!round) {
      throw new NotFoundException('session round not found');
    }

    const llmEvaluated = await this.openAICompatibleService.evaluateInterviewAnswer({
      workspaceId: (await this.prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { workspaceId: true },
      }))?.workspaceId ?? '',
      question: round.question,
      answer: input.userAnswer,
    });

    const evaluated = llmEvaluated ?? this.evaluateAnswer(round.question, input.userAnswer);
    const createFollowUp = input.createFollowUp ?? true;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRound = await tx.sessionRound.update({
        where: { id: roundId },
        data: {
          userAnswer: input.userAnswer.trim(),
          score: evaluated.score,
          feedback: evaluated.feedback,
          followUpQuestion: createFollowUp ? evaluated.followUpQuestion : null,
        },
      });

      let followUpRound: { id: string; question: string } | null = null;
      if (createFollowUp && evaluated.followUpQuestion) {
        followUpRound = await tx.sessionRound.create({
          data: {
            sessionId,
            question: evaluated.followUpQuestion,
            referenceAnswer: evaluated.followUpHint,
          },
          select: {
            id: true,
            question: true,
          },
        });
      }

      const allAnswered = await tx.sessionRound.findMany({
        where: {
          sessionId,
          userAnswer: { not: null },
          score: { not: null },
        },
        select: {
          score: true,
        },
      });

      const average =
        allAnswered.length === 0
          ? null
          : Math.round(allAnswered.reduce((sum, row) => sum + (row.score ?? 0), 0) / allAnswered.length);

      const updatedSession = await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          overallScore: average,
          status: SessionStatus.ACTIVE,
        },
        select: {
          id: true,
          overallScore: true,
          status: true,
        },
      });

      return {
        updatedRound,
        followUpRound,
        session: updatedSession,
      };
    });

    return result;
  }

  async getSessionProgress(sessionId: string) {
    await this.ensureSession(sessionId);
    const rounds = await this.prisma.sessionRound.findMany({
      where: { sessionId },
      select: {
        id: true,
        userAnswer: true,
        score: true,
      },
    });

    const total = rounds.length;
    const answered = rounds.filter((item) => item.userAnswer && item.userAnswer.trim().length > 0).length;
    const scoredRows = rounds.filter((item) => typeof item.score === 'number');
    const averageScore =
      scoredRows.length > 0
        ? Math.round(scoredRows.reduce((sum, item) => sum + (item.score ?? 0), 0) / scoredRows.length)
        : null;

    return {
      sessionId,
      totalRounds: total,
      answeredRounds: answered,
      progressPercent: total > 0 ? Math.round((answered / total) * 100) : 0,
      averageScore,
    };
  }

  async getSessionReview(sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        diagnosis: {
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        rounds: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('session not found');
    }

    const rounds = session.rounds;
    const diagnosisItems = session.diagnosis?.items ?? [];
    const totalRounds = rounds.length;
    const answeredRounds = rounds.filter((item) => item.userAnswer?.trim()).length;
    const scoredRounds = rounds.filter((item) => typeof item.score === 'number');
    const averageScore =
      scoredRounds.length > 0
        ? Math.round(scoredRounds.reduce((sum, row) => sum + (row.score ?? 0), 0) / scoredRounds.length)
        : null;

    const openItems = diagnosisItems.filter((item) => item.status === 'OPEN').length;
    const adoptedItems = diagnosisItems.filter((item) => item.status === 'ADOPTED').length;
    const ignoredItems = diagnosisItems.filter((item) => item.status === 'IGNORED').length;
    const manuallyEditedItems = diagnosisItems.filter((item) => item.status === 'MANUALLY_EDITED').length;
    const actionedItems = adoptedItems + ignoredItems + manuallyEditedItems;
    const actionedRate = diagnosisItems.length > 0 ? Math.round((actionedItems / diagnosisItems.length) * 100) : 0;

    const readinessLevel = this.evaluateReadiness({
      averageScore,
      openItems,
      answeredRounds,
      totalRounds,
    });

    const strongestRounds = [...scoredRounds]
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, 3)
      .map((round) => ({
        question: this.shortQuestion(round.question),
        score: round.score ?? 0,
        insight: round.feedback?.trim() || '回答结构较完整，可复用为模板答案。',
      }));

    const riskRounds = [...scoredRounds]
      .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))
      .slice(0, 3)
      .map((round) => ({
        question: this.shortQuestion(round.question),
        score: round.score ?? 0,
        insight: round.feedback?.trim() || '建议补充指标、权衡和个人决策细节。',
      }));

    const nextActions = this.buildNextActions({
      totalRounds,
      answeredRounds,
      averageScore,
      openItems,
      riskRounds,
      actionedRate,
    });

    return {
      sessionId: session.id,
      workspaceId: session.workspaceId,
      title: session.title,
      status: session.status,
      readinessLevel,
      score: {
        averageScore,
        totalRounds,
        answeredRounds,
        scoredRounds: scoredRounds.length,
      },
      diagnosis: {
        totalItems: diagnosisItems.length,
        openItems,
        adoptedItems,
        ignoredItems,
        manuallyEditedItems,
        actionedRate,
      },
      highlights: {
        strengths: strongestRounds,
        risks: riskRounds,
      },
      nextActions,
      generatedAt: new Date().toISOString(),
    };
  }

  async getSessionReviewTrends(workspaceId: string, weeks = 8) {
    const windowWeeks = Math.max(2, Math.min(24, weeks));
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowWeeks * 7 * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: cutoff,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        diagnosis: {
          select: {
            targetRole: true,
          },
        },
        rounds: {
          select: {
            userAnswer: true,
            score: true,
          },
        },
      },
    });

    type SessionMetric = {
      createdAt: Date;
      role: string;
      score: number | null;
      answeredRate: number;
    };

    const metrics: SessionMetric[] = sessions.map((session) => {
      const totalRounds = session.rounds.length;
      const answeredRounds = session.rounds.filter((round) => round.userAnswer?.trim()).length;
      const scoredRounds = session.rounds.filter((round) => typeof round.score === 'number');
      const averageScore =
        scoredRounds.length > 0
          ? Math.round(scoredRounds.reduce((sum, round) => sum + (round.score ?? 0), 0) / scoredRounds.length)
          : session.overallScore;

      return {
        createdAt: session.createdAt,
        role: this.normalizeRole(session.diagnosis?.targetRole, session.title),
        score: averageScore,
        answeredRate: totalRounds > 0 ? Math.round((answeredRounds / totalRounds) * 100) : 0,
      };
    });

    const weekMap = new Map<
      string,
      {
        weekLabel: string;
        sessionCount: number;
        scoreSum: number;
        scoreCount: number;
        answeredRateSum: number;
      }
    >();

    for (const metric of metrics) {
      const weekLabel = this.toWeekLabel(metric.createdAt);
      const existing = weekMap.get(weekLabel);
      const target =
        existing ??
        {
          weekLabel,
          sessionCount: 0,
          scoreSum: 0,
          scoreCount: 0,
          answeredRateSum: 0,
        };

      target.sessionCount += 1;
      target.answeredRateSum += metric.answeredRate;
      if (typeof metric.score === 'number') {
        target.scoreSum += metric.score;
        target.scoreCount += 1;
      }

      weekMap.set(weekLabel, target);
    }

    const byWeek = Array.from(weekMap.values())
      .sort((left, right) => left.weekLabel.localeCompare(right.weekLabel))
      .map((item) => ({
        weekLabel: item.weekLabel,
        sessionCount: item.sessionCount,
        averageScore: item.scoreCount > 0 ? Math.round(item.scoreSum / item.scoreCount) : null,
        averageAnsweredRate: item.sessionCount > 0 ? Math.round(item.answeredRateSum / item.sessionCount) : 0,
      }));

    const roleMap = new Map<
      string,
      {
        role: string;
        sessionCount: number;
        scoreSum: number;
        scoreCount: number;
        firstScored: number | null;
        latestScored: number | null;
      }
    >();

    for (const metric of metrics) {
      const existing = roleMap.get(metric.role);
      const target =
        existing ??
        {
          role: metric.role,
          sessionCount: 0,
          scoreSum: 0,
          scoreCount: 0,
          firstScored: null,
          latestScored: null,
        };

      target.sessionCount += 1;
      if (typeof metric.score === 'number') {
        target.scoreSum += metric.score;
        target.scoreCount += 1;
        if (target.firstScored === null) {
          target.firstScored = metric.score;
        }
        target.latestScored = metric.score;
      }

      roleMap.set(metric.role, target);
    }

    const byRole = Array.from(roleMap.values())
      .map((item) => ({
        role: item.role,
        sessionCount: item.sessionCount,
        averageScore: item.scoreCount > 0 ? Math.round(item.scoreSum / item.scoreCount) : null,
        scoreDelta:
          item.firstScored !== null && item.latestScored !== null
            ? item.latestScored - item.firstScored
            : null,
      }))
      .sort((left, right) => right.sessionCount - left.sessionCount)
      .slice(0, 8);

    return {
      workspaceId,
      windowWeeks,
      byWeek,
      byRole,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildQuestionSeeds(
    session: {
      title: string;
      diagnosis: { targetRole: string | null; techStack: string | null; items: Array<{ title: string; category: string }>; } | null;
    },
    focus?: string,
  ) {
    const diagnosisItems = session.diagnosis?.items ?? [];
    const categories = diagnosisItems.map((item) => item.category).slice(0, 6);
    const titles = diagnosisItems.map((item) => item.title).slice(0, 6);
    const role = session.diagnosis?.targetRole ?? '目标岗位';
    const techStack = session.diagnosis?.techStack ?? '核心技术栈';

    const seeds = [
      `请用 STAR 结构介绍一个最能体现你胜任 ${role} 的项目。`,
      `你在项目中如何做技术选型？请结合 ${techStack} 说明权衡过程。`,
      `说一个你做过性能/稳定性优化的案例，重点讲指标变化。`,
      `讲一次线上问题处理经历：定位过程、根因和预防方案。`,
      `如果让你重做该项目，你会改哪 1-2 个关键设计？`,
      `你如何与产品、测试或跨团队协作推进交付？`,
    ];

    for (const category of categories) {
      seeds.push(`你的简历在“${category}”上被标记为薄弱项，如何在面试中补强这一块？`);
    }
    for (const title of titles) {
      seeds.push(`针对“${title}”，面试官深挖时你会怎么展开关键细节？`);
    }
    if (focus) {
      seeds.unshift(`本轮聚焦 ${focus}，请给出一个可量化成果的完整案例。`);
    }

    return [...new Set(seeds)];
  }

  private renderQuestion(seed: string, index: number, focus?: string) {
    if (!focus) {
      return `${index}. ${seed}`;
    }
    return `${index}. [${focus}] ${seed}`;
  }

  private renderReferenceAnswer(seed: string) {
    return `建议回答结构：背景与目标 -> 你的核心行动 -> 技术细节与权衡 -> 量化结果 -> 复盘。问题参考：${seed}`;
  }

  private evaluateAnswer(question: string, answer: string) {
    const content = answer.trim();
    const charLength = content.length;
    const metricCount = (content.match(/(\d+%|\d+\s*(ms|s|分钟|小时|天|万|k|K)|提升|下降|减少|增长|ROI|转化率|留存)/g) ?? [])
      .length;
    const hasStructure = /首先|然后|最后|背景|目标|行动|结果|复盘|挑战|方案/.test(content);
    const hasTradeOff = /权衡|取舍|trade[- ]?off|成本|风险|兼容|复杂度/.test(content);
    const hasOwnership = /我负责|我主导|我推动|我设计|我实现|我排查/.test(content);

    const lengthScore = Math.min(25, Math.round((charLength / 260) * 25));
    const metricScore = Math.min(25, metricCount * 8);
    const structureScore = hasStructure ? 15 : 6;
    const tradeOffScore = hasTradeOff ? 12 : 4;
    const ownershipScore = hasOwnership ? 10 : 5;
    const score = Math.max(30, Math.min(98, 25 + lengthScore + metricScore + structureScore + tradeOffScore + ownershipScore));

    const feedbackParts: string[] = [];
    if (charLength < 120) feedbackParts.push('回答偏短，建议增加背景、决策过程和结果复盘。');
    else feedbackParts.push('回答完整度尚可。');

    if (metricCount === 0) feedbackParts.push('缺少量化指标，建议补充性能、效率或业务结果数字。');
    else feedbackParts.push('有量化信息，建议再补 1 个业务价值指标提升说服力。');

    if (!hasTradeOff) feedbackParts.push('可补充技术权衡与取舍逻辑，体现高级工程判断力。');
    if (!hasOwnership) feedbackParts.push('建议明确你个人职责，避免“团队做了什么”掩盖个人贡献。');

    const followUpQuestion = this.buildFollowUpQuestion(question, { metricCount, hasTradeOff, hasOwnership, charLength });
    const followUpHint = this.buildFollowUpHint({ metricCount, hasTradeOff, hasOwnership });

    return {
      score,
      feedback: feedbackParts.join(' '),
      followUpQuestion,
      followUpHint,
    };
  }

  private buildFollowUpQuestion(
    question: string,
    signal: { metricCount: number; hasTradeOff: boolean; hasOwnership: boolean; charLength: number },
  ) {
    if (signal.metricCount === 0) {
      return `你刚才提到的案例里，能补充 2 个具体指标吗？例如上线前后性能、稳定性或业务转化变化。`;
    }
    if (!signal.hasTradeOff) {
      return '如果当时有两种技术方案可选，你为什么最终选了当前方案？请讲清楚取舍标准。';
    }
    if (!signal.hasOwnership) {
      return '这个项目中你个人最关键的决策是什么？如果没有你，这个结果最可能在哪一步失败？';
    }
    if (signal.charLength < 220) {
      return `针对问题“${question}”，请进一步展开一个你踩过的坑以及最终修复路径。`;
    }
    return '如果要把这个经验迁移到更大规模系统，你会先改哪三件事？为什么？';
  }

  private buildFollowUpHint(signal: { metricCount: number; hasTradeOff: boolean; hasOwnership: boolean }) {
    if (signal.metricCount === 0) {
      return '从“基线指标 -> 优化动作 -> 结果指标”三段式回答。';
    }
    if (!signal.hasTradeOff) {
      return '对比两个方案的性能、复杂度、维护成本和风险。';
    }
    if (!signal.hasOwnership) {
      return '强调你负责的关键链路、决策点和结果责任。';
    }
    return '回答中补充可迁移性和规模化思考。';
  }

  private normalizeRole(role: string | null | undefined, title: string) {
    if (role?.trim()) {
      return role.trim();
    }
    const matched = title.match(/(前端|后端|全栈|算法|测试|产品|运维|数据)/);
    if (matched) {
      return `${matched[1]}方向`;
    }
    return '未指定岗位';
  }

  private toWeekLabel(date: Date) {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const dayOffset = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.floor((dayOffset + firstDayOfYear.getDay()) / 7) + 1;
    const weekText = String(week).padStart(2, '0');
    return `${year}-W${weekText}`;
  }

  private evaluateReadiness(input: {
    averageScore: number | null;
    openItems: number;
    answeredRounds: number;
    totalRounds: number;
  }) {
    const answeredThreshold = Math.max(3, Math.ceil(input.totalRounds * 0.6));
    if (
      input.averageScore !== null &&
      input.averageScore >= 85 &&
      input.openItems <= 1 &&
      input.answeredRounds >= answeredThreshold
    ) {
      return 'READY';
    }

    if (
      input.averageScore !== null &&
      input.averageScore >= 70 &&
      input.openItems <= 3 &&
      input.answeredRounds >= Math.max(2, Math.floor(answeredThreshold * 0.7))
    ) {
      return 'IMPROVING';
    }

    return 'RISK';
  }

  private shortQuestion(question: string) {
    const trimmed = question.replace(/^\d+\.\s*/, '').trim();
    if (trimmed.length <= 48) {
      return trimmed;
    }
    return `${trimmed.slice(0, 48)}...`;
  }

  private buildNextActions(input: {
    totalRounds: number;
    answeredRounds: number;
    averageScore: number | null;
    openItems: number;
    riskRounds: Array<{ question: string; score: number; insight: string }>;
    actionedRate: number;
  }) {
    const actions: Array<{ priority: 'HIGH' | 'MEDIUM' | 'LOW'; action: string; reason: string }> = [];

    if (input.openItems > 0) {
      actions.push({
        priority: 'HIGH',
        action: `先处理剩余 ${input.openItems} 条 OPEN 诊断卡片`,
        reason: '未处理问题会持续影响问答表现与简历一致性。',
      });
    }

    if (input.riskRounds.length > 0) {
      const weakest = input.riskRounds[0];
      actions.push({
        priority: 'HIGH',
        action: `针对低分题“${weakest.question}”重写 STAR 回答并补指标`,
        reason: `当前分数 ${weakest.score}，需优先补齐量化结果与技术权衡。`,
      });
    }

    if (input.averageScore === null || input.averageScore < 75) {
      actions.push({
        priority: 'MEDIUM',
        action: '追加 3 轮同主题追问训练',
        reason: '整体分数仍偏低，建议通过同主题高频演练稳定表达。',
      });
    }

    if (input.answeredRounds < Math.max(3, input.totalRounds)) {
      actions.push({
        priority: 'MEDIUM',
        action: '补全未作答轮次并完成批改',
        reason: '当前练习覆盖率不足，统计结果可能失真。',
      });
    }

    if (input.actionedRate >= 70 && (input.averageScore ?? 0) >= 80) {
      actions.push({
        priority: 'LOW',
        action: '开始下一岗位方向的迁移训练',
        reason: '当前会话准备度较好，可进行跨场景稳定性验证。',
      });
    }

    if (actions.length === 0) {
      actions.push({
        priority: 'MEDIUM',
        action: '保持每周一次复盘并滚动更新简历案例',
        reason: '当前状态稳定，建议通过周期性复盘维持面试手感。',
      });
    }

    return actions.slice(0, 5);
  }

  private async ensureSession(sessionId: string) {
    const exists = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('session not found');
    }
  }
}
