import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateModelConfigDto } from './dto/create-model-config.dto';
import { TestModelConnectionDto } from './dto/test-model-connection.dto';
import { UpdateModelConfigDto } from './dto/update-model-config.dto';
import { ModelConfigsService } from './model-configs.service';

@Controller('v1/model-configs')
export class ModelConfigsController {
  constructor(private readonly modelConfigsService: ModelConfigsService) {}

  @Get()
  listConfigs(@Query('workspaceId') workspaceId?: string) {
    if (!workspaceId) {
      return [];
    }
    return this.modelConfigsService.listConfigs(workspaceId);
  }

  @Post()
  createConfig(@Body() body: CreateModelConfigDto) {
    return this.modelConfigsService.createConfig(body);
  }

  @Patch(':configId')
  updateConfig(@Param('configId') configId: string, @Body() body: UpdateModelConfigDto) {
    return this.modelConfigsService.updateConfig(configId, body);
  }

  @Post(':configId/test')
  testConfigConnection(@Param('configId') configId: string) {
    return this.modelConfigsService.testConfigConnection(configId);
  }

  @Get(':configId/models')
  listConfigModels(@Param('configId') configId: string) {
    return this.modelConfigsService.listConfigModels(configId);
  }

  @Post('test-direct')
  testDirectConnection(@Body() body: TestModelConnectionDto) {
    return this.modelConfigsService.testDirectConnection(body);
  }
}

