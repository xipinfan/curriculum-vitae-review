import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceKeysService } from './workspace-keys.service';

@Controller('v1/workspaces')
export class WorkspaceKeysController {
  constructor(private readonly workspaceKeysService: WorkspaceKeysService) {}

  @Post()
  createWorkspace(@Body() body: CreateWorkspaceDto) {
    return this.workspaceKeysService.createWorkspace(body);
  }

  @Get()
  listWorkspaces() {
    return this.workspaceKeysService.listWorkspaces();
  }

  @Get('validate-key/:accessKey')
  async validateKey(@Param('accessKey') accessKey: string) {
    return this.workspaceKeysService.validate(accessKey);
  }
}
