import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspaceKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(input: CreateWorkspaceDto) {
    try {
      return await this.prisma.workspace.create({
        data: {
          name: input.name.trim(),
          accessKey: input.accessKey.trim(),
          status: WorkspaceStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          accessKey: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('accessKey already exists');
      }
      throw error;
    }
  }

  async listWorkspaces() {
    return this.prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async validate(accessKey: string) {
    const normalized = accessKey.trim();
    if (!normalized) {
      return { valid: false, workspaceId: null as string | null, workspaceName: null as string | null };
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: {
        accessKey: normalized,
        status: WorkspaceStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (workspace) {
      return {
        valid: true,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      };
    }

    const adminKey = process.env.ADMIN_KEY?.trim();
    const isLegacyAdmin = adminKey && normalized === adminKey;
    if (isLegacyAdmin) {
      const adminWorkspace = await this.prisma.workspace.upsert({
        where: { accessKey: normalized },
        update: { status: WorkspaceStatus.ACTIVE },
        create: {
          name: 'Legacy Admin Workspace',
          accessKey: normalized,
          status: WorkspaceStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
        },
      });

      return {
        valid: true,
        workspaceId: adminWorkspace.id,
        workspaceName: adminWorkspace.name,
      };
    }

    return {
      valid: false,
      workspaceId: null,
      workspaceName: null,
    };
  }
}
