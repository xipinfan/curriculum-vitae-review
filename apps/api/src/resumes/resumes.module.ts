import { Module } from '@nestjs/common';
import { ResumeParserService } from './resume-parser.service';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';

@Module({
  controllers: [ResumesController],
  providers: [ResumesService, ResumeParserService],
})
export class ResumesModule {}

