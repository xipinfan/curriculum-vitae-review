import { Module } from '@nestjs/common';
import { OpenAICompatibleService } from '../llm/openai-compatible.service';
import { DiagnosisAgentService } from './diagnosis-agent.service';
import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisEventsService } from './diagnosis-events.service';
import { DiagnosisService } from './diagnosis.service';

@Module({
  controllers: [DiagnosisController],
  providers: [DiagnosisService, DiagnosisEventsService, DiagnosisAgentService, OpenAICompatibleService],
})
export class DiagnosisModule {}
