import { Module } from '@nestjs/common';
import { OpenAICompatibleService } from '../llm/openai-compatible.service';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, OpenAICompatibleService],
})
export class SessionsModule {}
