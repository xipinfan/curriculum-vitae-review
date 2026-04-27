import { Module } from '@nestjs/common';
import { ModelConfigsController } from './model-configs.controller';
import { ModelConfigsService } from './model-configs.service';

@Module({
  controllers: [ModelConfigsController],
  providers: [ModelConfigsService],
})
export class ModelConfigsModule {}

