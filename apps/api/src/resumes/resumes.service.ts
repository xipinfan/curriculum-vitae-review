import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ResumeSourceType, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ImportResumeDto } from './dto/import-resume.dto';
import { ParseResumeDto } from './dto/parse-resume.dto';
import { ResumeParserService } from './resume-parser.service';

@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resumeParser: ResumeParserService,
  ) {}

  async importResume(input: ImportResumeDto) {
    if (input.sourceType === ResumeSourceType.PDF || input.sourceType === ResumeSourceType.DOCX) {
      throw new BadRequestException('PDF/DOCX import is not supported in current stage');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { id: input.workspaceId, status: WorkspaceStatus.ACTIVE },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException('workspace not found or disabled');
    }

    return this.prisma.resumeDocument.create({
      data: {
        workspaceId: input.workspaceId,
        sourceType: input.sourceType,
        rawText: input.content.trim(),
      },
      select: {
        id: true,
        workspaceId: true,
        sourceType: true,
        createdAt: true,
      },
    });
  }

  async getResume(resumeId: string) {
    const resume = await this.prisma.resumeDocument.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        workspaceId: true,
        sourceType: true,
        rawText: true,
        parsedData: true,
        parserVersion: true,
        parsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!resume) {
      throw new NotFoundException('resume document not found');
    }
    return resume;
  }

  async parseResume(resumeId: string, input: ParseResumeDto) {
    const resume = await this.prisma.resumeDocument.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        sourceType: true,
        rawText: true,
        parsedData: true,
        parserVersion: true,
        parsedAt: true,
      },
    });

    if (!resume) {
      throw new NotFoundException('resume document not found');
    }

    if (!input.force && resume.parsedData) {
      return {
        resumeId: resume.id,
        parserVersion: resume.parserVersion,
        parsedAt: resume.parsedAt,
        parsedData: resume.parsedData,
        reused: true,
      };
    }

    const parsed = this.resumeParser.parse(resume.rawText, resume.sourceType);
    const updated = await this.prisma.resumeDocument.update({
      where: { id: resumeId },
      data: {
        parsedData: parsed.parsedData,
        parserVersion: parsed.parserVersion,
        parsedAt: new Date(),
      },
      select: {
        id: true,
        parserVersion: true,
        parsedAt: true,
        parsedData: true,
      },
    });

    return {
      resumeId: updated.id,
      parserVersion: updated.parserVersion,
      parsedAt: updated.parsedAt,
      parsedData: updated.parsedData,
      reused: false,
    };
  }

  async getStructuredResume(resumeId: string) {
    const resume = await this.prisma.resumeDocument.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        parserVersion: true,
        parsedAt: true,
        parsedData: true,
      },
    });
    if (!resume) {
      throw new NotFoundException('resume document not found');
    }
    return resume;
  }
}

