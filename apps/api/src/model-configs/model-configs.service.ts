import { BadGatewayException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModelConfigStatus, Prisma, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModelConfigDto } from './dto/create-model-config.dto';
import { TestModelConnectionDto } from './dto/test-model-connection.dto';
import { UpdateModelConfigDto } from './dto/update-model-config.dto';

type OpenAIModelListResponse = {
  object?: string;
  data?: Array<{
    id?: string;
    object?: string;
  }>;
};

@Injectable()
export class ModelConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async listConfigs(workspaceId: string) {
    const list = await this.prisma.modelConfig.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((item) => this.toSafeConfig(item));
  }

  async createConfig(input: CreateModelConfigDto) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: input.workspaceId,
        status: WorkspaceStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('workspace not found or disabled');
    }

    try {
      const created = await this.prisma.modelConfig.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name.trim(),
          baseUrl: this.normalizeBaseUrl(input.baseUrl),
          apiKey: input.apiKey.trim(),
          defaultModel: input.defaultModel?.trim(),
          status: input.status ?? ModelConfigStatus.ACTIVE,
        },
      });
      return this.toSafeConfig(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('model config name already exists in workspace');
      }
      throw error;
    }
  }

  async updateConfig(configId: string, input: UpdateModelConfigDto) {
    const existing = await this.prisma.modelConfig.findUnique({
      where: { id: configId },
    });
    if (!existing) {
      throw new NotFoundException('model config not found');
    }

    const updated = await this.prisma.modelConfig.update({
      where: { id: configId },
      data: {
        name: input.name?.trim(),
        baseUrl: input.baseUrl ? this.normalizeBaseUrl(input.baseUrl) : undefined,
        apiKey: input.apiKey?.trim(),
        defaultModel: input.defaultModel?.trim(),
        status: input.status,
      },
    });
    return this.toSafeConfig(updated);
  }

  async testConfigConnection(configId: string) {
    const config = await this.prisma.modelConfig.findUnique({ where: { id: configId } });
    if (!config) {
      throw new NotFoundException('model config not found');
    }

    return this.testConnection({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.defaultModel ?? undefined,
    });
  }

  async listConfigModels(configId: string) {
    const config = await this.prisma.modelConfig.findUnique({ where: { id: configId } });
    if (!config) {
      throw new NotFoundException('model config not found');
    }

    const models = await this.fetchModelList(config.baseUrl, config.apiKey);
    return {
      configId: config.id,
      modelCount: models.length,
      models,
    };
  }

  async testDirectConnection(input: TestModelConnectionDto) {
    return this.testConnection(input);
  }

  private async testConnection(input: TestModelConnectionDto) {
    const models = await this.fetchModelList(input.baseUrl, input.apiKey);
    const available = new Set(models);

    return {
      ok: input.model ? available.has(input.model) : models.length > 0,
      requestedModel: input.model ?? null,
      hasRequestedModel: input.model ? available.has(input.model) : null,
      modelCount: models.length,
      models: models.slice(0, 60),
    };
  }

  private async fetchModelList(baseUrl: string, apiKey: string) {
    const normalizedBase = this.normalizeBaseUrl(baseUrl);
    const endpoint = `${normalizedBase}/models`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 12000);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadGatewayException(
          `model provider error (${response.status}): ${errorText || response.statusText}`,
        );
      }

      const payload = (await response.json()) as OpenAIModelListResponse;
      const models = (payload.data ?? [])
        .map((item) => item.id?.trim())
        .filter((item): item is string => Boolean(item));

      return [...new Set(models)];
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException('model provider timeout');
      }
      throw new BadGatewayException(error instanceof Error ? error.message : 'failed to connect model provider');
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, '');
  }

  private maskApiKey(apiKey: string) {
    if (apiKey.length <= 8) {
      return '********';
    }
    return `${apiKey.slice(0, 4)}***${apiKey.slice(-3)}`;
  }

  private toSafeConfig(config: {
    id: string;
    workspaceId: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    defaultModel: string | null;
    status: ModelConfigStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: config.id,
      workspaceId: config.workspaceId,
      name: config.name,
      baseUrl: config.baseUrl,
      apiKeyMasked: this.maskApiKey(config.apiKey),
      defaultModel: config.defaultModel,
      status: config.status,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}

