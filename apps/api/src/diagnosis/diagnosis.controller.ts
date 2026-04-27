import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApplyDiagnosisItemActionDto } from './dto/apply-diagnosis-item-action.dto';
import { CreateDiagnosisItemDto } from './dto/create-diagnosis-item.dto';
import { CreateDiagnosisJobDto } from './dto/create-diagnosis-job.dto';
import { UpdateDiagnosisJobStatusDto } from './dto/update-diagnosis-job-status.dto';
import { DiagnosisService } from './diagnosis.service';

@Controller('v1/diagnosis/jobs')
export class DiagnosisController {
  constructor(private readonly diagnosisService: DiagnosisService) {}

  @Get()
  listJobsByWorkspace(@Query('workspaceId') workspaceId?: string) {
    if (!workspaceId) {
      return [];
    }
    return this.diagnosisService.listJobsByWorkspace(workspaceId);
  }

  @Post()
  createJob(@Body() body: CreateDiagnosisJobDto) {
    return this.diagnosisService.createJob(body);
  }

  @Post(':jobId/start')
  startJob(@Param('jobId') jobId: string) {
    return this.diagnosisService.startJob(jobId);
  }

  @Get(':jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.diagnosisService.getJob(jobId);
  }

  @Get(':jobId/stream')
  async streamJob(@Param('jobId') jobId: string, @Res() response: any) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    const send = (event: string, data: unknown) => {
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const job = await this.diagnosisService.getJob(jobId);
    send('snapshot', job);

    const unsubscribe = this.diagnosisService.subscribeJobEvents(jobId, (payload) => send('update', payload));
    const heartbeat = setInterval(() => send('ping', { now: Date.now() }), 15000);

    response.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  }

  @Patch(':jobId/status')
  updateJobStatus(@Param('jobId') jobId: string, @Body() body: UpdateDiagnosisJobStatusDto) {
    return this.diagnosisService.updateJobStatus(jobId, body);
  }

  @Get(':jobId/items')
  listItems(@Param('jobId') jobId: string) {
    return this.diagnosisService.listItems(jobId);
  }

  @Post(':jobId/items')
  createItem(@Param('jobId') jobId: string, @Body() body: CreateDiagnosisItemDto) {
    return this.diagnosisService.createItem(jobId, body);
  }

  @Patch(':jobId/items/:itemId/action')
  applyItemAction(
    @Param('jobId') jobId: string,
    @Param('itemId') itemId: string,
    @Body() body: ApplyDiagnosisItemActionDto,
  ) {
    return this.diagnosisService.applyItemAction(jobId, itemId, body);
  }
}
