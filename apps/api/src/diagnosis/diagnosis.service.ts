import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DiagnosisItemStatus, DiagnosisJobStatus, DiagnosisSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyDiagnosisItemActionDto, DiagnosisItemAction } from './dto/apply-diagnosis-item-action.dto';
import { CreateDiagnosisItemDto } from './dto/create-diagnosis-item.dto';
import { CreateDiagnosisJobDto } from './dto/create-diagnosis-job.dto';
import { UpdateDiagnosisJobStatusDto } from './dto/update-diagnosis-job-status.dto';
import { DiagnosisAgentService } from './diagnosis-agent.service';
import { DiagnosisEventsService } from './diagnosis-events.service';

@Injectable()
export class DiagnosisService implements OnModuleInit {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisEvents: DiagnosisEventsService,
    private readonly diagnosisAgentService: DiagnosisAgentService,
  ) {}

  async onModuleInit() {
    const recovered = await this.prisma.diagnosisJob.updateMany({
      where: { status: DiagnosisJobStatus.RUNNING },
      data: {
        status: DiagnosisJobStatus.FAILED,
        errorMessage: '诊断服务重启，任务已中断，请重新执行一次诊断。',
        completedAt: new Date(),
      },
    });

    if (recovered.count > 0) {
      this.logger.warn(`Recovered ${recovered.count} interrupted diagnosis job(s) after service restart.`);
    }
  }

  async createJob(input: CreateDiagnosisJobDto) {
    return this.prisma.diagnosisJob.create({
      data: {
        workspaceId: input.workspaceId,
        resumeDocumentId: input.resumeDocumentId,
        targetRole: input.targetRole,
        targetLevel: input.targetLevel,
        techStack: input.techStack,
        businessDomain: input.businessDomain,
      },
    });
  }

  async listJobsByWorkspace(workspaceId: string) {
    return this.prisma.diagnosisJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async getJob(jobId: string) {
    const job = await this.prisma.diagnosisJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('diagnosis job not found');
    }

    return job;
  }

  async updateJobStatus(jobId: string, input: UpdateDiagnosisJobStatusDto) {
    await this.ensureJob(jobId);

    const updated = await this.prisma.diagnosisJob.update({
      where: { id: jobId },
      data: {
        status: input.status,
        errorMessage: input.errorMessage,
        completedAt:
          input.status === DiagnosisJobStatus.COMPLETED || input.status === DiagnosisJobStatus.FAILED
            ? new Date()
            : null,
      },
    });

    this.emitJobEvent(jobId, 'status-updated', {
      status: updated.status,
      errorMessage: updated.errorMessage,
      completedAt: updated.completedAt,
    });

    return updated;
  }

  async listItems(jobId: string) {
    await this.ensureJob(jobId);
    return this.prisma.diagnosisItem.findMany({
      where: { diagnosisJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createItem(jobId: string, input: CreateDiagnosisItemDto) {
    await this.ensureJob(jobId);

    return this.prisma.diagnosisItem.create({
      data: {
        diagnosisJobId: jobId,
        category: input.category,
        severity: input.severity,
        title: input.title,
        description: input.description,
        suggestion: input.suggestion,
        editedContent: undefined,
        status: input.status,
        userNote: input.userNote,
      },
    });
  }

  async applyItemAction(jobId: string, itemId: string, input: ApplyDiagnosisItemActionDto) {
    const existing = await this.prisma.diagnosisItem.findFirst({
      where: {
        id: itemId,
        diagnosisJobId: jobId,
      },
      select: {
        id: true,
        diagnosisJobId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('diagnosis item not found');
    }

    let nextStatus: DiagnosisItemStatus;
    let editedContent: string | null | undefined;
    if (input.action === DiagnosisItemAction.ADOPT) {
      nextStatus = DiagnosisItemStatus.ADOPTED;
      editedContent = null;
    } else if (input.action === DiagnosisItemAction.IGNORE) {
      nextStatus = DiagnosisItemStatus.IGNORED;
      editedContent = null;
    } else {
      if (!input.editedContent?.trim()) {
        throw new BadRequestException('editedContent is required when action is MANUAL_EDIT');
      }
      nextStatus = DiagnosisItemStatus.MANUALLY_EDITED;
      editedContent = input.editedContent.trim();
    }

    const updated = await this.prisma.diagnosisItem.update({
      where: { id: itemId },
      data: {
        status: nextStatus,
        userNote: input.userNote?.trim() ?? null,
        editedContent,
      },
    });

    this.emitJobEvent(jobId, 'item-action-applied', {
      itemId,
      action: input.action,
      status: updated.status,
    });

    return updated;
  }

  async startJob(jobId: string) {
    const current = await this.ensureJob(jobId);
    if (current.status === DiagnosisJobStatus.RUNNING) {
      return { started: false, reason: 'already-running' };
    }

    if (current.status === DiagnosisJobStatus.COMPLETED) {
      return { started: false, reason: 'already-completed' };
    }

    await this.prisma.diagnosisJob.update({
      where: { id: jobId },
      data: {
        status: DiagnosisJobStatus.RUNNING,
        errorMessage: null,
        completedAt: null,
      },
    });

    this.emitJobEvent(jobId, 'status-updated', { status: DiagnosisJobStatus.RUNNING, progress: 5 });
    void this.runJobInBackground(jobId);

    return { started: true };
  }

  subscribeJobEvents(jobId: string, listener: (payload: unknown) => void) {
    return this.diagnosisEvents.subscribe(jobId, listener);
  }

  private async runJobInBackground(jobId: string) {
    try {
      this.emitJobEvent(jobId, 'progress', { progress: 15, message: 'loading resume' });
      await this.sleep(120);

      const job = await this.prisma.diagnosisJob.findUnique({
        where: { id: jobId },
        include: {
          resume: {
            select: {
              rawText: true,
              parsedData: true,
            },
          },
        },
      });

      if (!job) {
        throw new Error('diagnosis job not found');
      }

      this.emitJobEvent(jobId, 'progress', { progress: 30, message: 'building diagnosis plan' });

      const fallbackItems = this.generateItems(job.resume?.rawText, job.resume?.parsedData);
      const agentResult = await this.diagnosisAgentService.execute(
        {
          workspaceId: job.workspaceId,
          targetRole: job.targetRole,
          targetLevel: job.targetLevel,
          techStack: job.techStack,
          businessDomain: job.businessDomain,
          rawText: job.resume?.rawText ?? '',
          parsedData: job.resume?.parsedData ?? undefined,
          count: 6,
          fallbackItems,
        },
        (event) => {
          this.emitJobEvent(jobId, 'progress', {
            progress: event.progress,
            stepId: event.stepId,
            stepTitle: event.stepTitle,
            phase: event.phase,
            message: event.message,
            itemCount: event.itemCount,
          });
        },
      );

      const generatedItems = agentResult.items;
      this.emitJobEvent(jobId, 'progress', { progress: 90, message: 'writing diagnosis items' });

      await this.prisma.$transaction(async (tx) => {
        await tx.diagnosisItem.deleteMany({ where: { diagnosisJobId: jobId } });
        await tx.diagnosisItem.createMany({
          data: generatedItems.map((item) => ({
            diagnosisJobId: jobId,
            category: item.category,
            severity: item.severity,
            title: item.title,
            description: item.description,
            suggestion: item.suggestion,
          })),
        });

        await tx.diagnosisJob.update({
          where: { id: jobId },
          data: {
            status: DiagnosisJobStatus.COMPLETED,
            errorMessage: null,
            completedAt: new Date(),
          },
        });
      });

      this.emitJobEvent(jobId, 'completed', {
        status: DiagnosisJobStatus.COMPLETED,
        itemCount: generatedItems.length,
        provider: agentResult.provider,
        steps: agentResult.steps,
        progress: 100,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown diagnosis failure';
      await this.prisma.diagnosisJob.update({
        where: { id: jobId },
        data: {
          status: DiagnosisJobStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        },
      });
      this.emitJobEvent(jobId, 'failed', { status: DiagnosisJobStatus.FAILED, errorMessage });
    }
  }

  private generateItems(rawText?: string, parsedData?: Prisma.JsonValue) {
    const content = (rawText ?? '').trim();
    const textLength = content.length;
    const metricCount = (content.match(/(\d+%|\d+\s*(万|k|K)|同比|环比|ROI|留存|转化率)/g) ?? []).length;
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const projectLineCount = lines.filter((line) => /项目|project/i.test(line)).length;

    const parsed = (parsedData ?? {}) as {
      skills?: string[];
      experiences?: Array<{ headline?: string }>;
      basics?: { summary?: string };
    };

    const skillCount = Array.isArray(parsed.skills) ? parsed.skills.length : 0;
    const experienceCount = Array.isArray(parsed.experiences) ? parsed.experiences.length : 0;
    const summaryLength = parsed.basics?.summary?.trim().length ?? 0;

    const items: Array<{
      category: string;
      severity: DiagnosisSeverity;
      title: string;
      description: string;
      suggestion: string;
    }> = [];

    if (textLength < 240) {
      items.push({
        category: 'content-depth',
        severity: DiagnosisSeverity.HIGH,
        title: '简历内容偏短，信息密度不足',
        description: '当前简历文本较短，难以覆盖项目背景、技术细节和结果价值，面试官很难形成完整判断。',
        suggestion: '至少补充 2-3 段可展开追问的项目描述，并写明你的职责、关键技术和业务结果。',
      });
    }

    if (metricCount < 2) {
      items.push({
        category: 'metrics',
        severity: DiagnosisSeverity.HIGH,
        title: '量化指标偏少，成果说服力不足',
        description: '简历中的结果描述缺少量化指标，容易被认为“做过但不知效果”。',
        suggestion: '为每个核心项目补充 1-2 个业务指标，例如响应时延、成本降低、转化率提升或故障率下降。',
      });
    }

    if (skillCount > 0 && skillCount < 5) {
      items.push({
        category: 'skill-coverage',
        severity: DiagnosisSeverity.MEDIUM,
        title: '技能覆盖较窄，建议补充上下文能力',
        description: '当前技能条目较少，难以体现端到端交付能力和工程广度。',
        suggestion: '在核心技能之外补充工程实践项，如测试、可观测性、部署、性能优化等。',
      });
    }

    if (experienceCount === 0 && projectLineCount < 2) {
      items.push({
        category: 'experience-clarity',
        severity: DiagnosisSeverity.HIGH,
        title: '经历结构不清晰，面试追问路径不明确',
        description: '简历中没有足够清晰的经历/项目条目，面试官难以基于时间线进行深入追问。',
        suggestion: '按“时间段 + 团队/项目 + 职责 + 结果”拆成结构化条目，至少保证 2 段可展开叙述。',
      });
    }

    if (summaryLength > 0 && summaryLength < 40) {
      items.push({
        category: 'summary',
        severity: DiagnosisSeverity.MEDIUM,
        title: '个人总结过短，定位不够明确',
        description: '总结区内容过短，无法快速建立你的岗位匹配度和技术定位。',
        suggestion: '补充 2-3 句摘要，说明目标岗位、核心技术优势和代表性业务场景。',
      });
    }

    if (items.length === 0) {
      items.push({
        category: 'overall',
        severity: DiagnosisSeverity.LOW,
        title: '基础信息完整，可进入细化优化阶段',
        description: '当前简历信息结构较完整，建议继续围绕高概率追问点进行表达打磨。',
        suggestion: '优先完善项目中“难点决策、权衡过程、结果复盘”三类叙述，以提升面试稳定性。',
      });
    }

    return items;
  }

  private emitJobEvent(jobId: string, type: string, payload: Record<string, unknown>) {
    this.diagnosisEvents.emit(jobId, {
      jobId,
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async ensureJob(jobId: string) {
    const exists = await this.prisma.diagnosisJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    });

    if (!exists) {
      throw new NotFoundException('diagnosis job not found');
    }

    return exists;
  }
}
