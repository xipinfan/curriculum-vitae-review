import { Module } from '@nestjs/common';
import { WorkspaceKeysController } from './workspace-keys.controller';
import { WorkspaceKeysService } from './workspace-keys.service';

@Module({
  controllers: [WorkspaceKeysController],
  providers: [WorkspaceKeysService],
})
export class WorkspacesModule {}

