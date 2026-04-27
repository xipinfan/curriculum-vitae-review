import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ImportResumeDto } from './dto/import-resume.dto';
import { ParseResumeDto } from './dto/parse-resume.dto';
import { ResumesService } from './resumes.service';

@Controller('v1/resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post('import')
  importResume(@Body() body: ImportResumeDto) {
    return this.resumesService.importResume(body);
  }

  @Get(':resumeId')
  getResume(@Param('resumeId') resumeId: string) {
    return this.resumesService.getResume(resumeId);
  }

  @Post(':resumeId/parse')
  parseResume(@Param('resumeId') resumeId: string, @Body() body: ParseResumeDto) {
    return this.resumesService.parseResume(resumeId, body);
  }

  @Get(':resumeId/structured')
  getStructuredResume(@Param('resumeId') resumeId: string) {
    return this.resumesService.getStructuredResume(resumeId);
  }
}

