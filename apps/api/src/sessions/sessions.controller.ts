import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateSessionRoundDto } from './dto/create-session-round.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { GenerateSessionQuestionsDto } from './dto/generate-session-questions.dto';
import { SubmitSessionAnswerDto } from './dto/submit-session-answer.dto';
import { SessionsService } from './sessions.service';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';

@Controller('v1/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  listSessionsByWorkspace(@Query('workspaceId') workspaceId?: string) {
    if (!workspaceId) {
      return [];
    }
    return this.sessionsService.listSessionsByWorkspace(workspaceId);
  }

  @Get('review-trends')
  getSessionReviewTrends(@Query('workspaceId') workspaceId?: string, @Query('weeks') weeks?: string) {
    if (!workspaceId) {
      return {
        workspaceId: '',
        windowWeeks: 0,
        byWeek: [],
        byRole: [],
        generatedAt: new Date().toISOString(),
      };
    }
    const parsedWeeks = Number.parseInt(weeks ?? '', 10);
    return this.sessionsService.getSessionReviewTrends(
      workspaceId,
      Number.isFinite(parsedWeeks) && parsedWeeks > 0 ? parsedWeeks : undefined,
    );
  }

  @Post()
  createSession(@Body() body: CreateSessionDto) {
    return this.sessionsService.createSession(body);
  }

  @Post(':sessionId/generate-questions')
  generateQuestions(@Param('sessionId') sessionId: string, @Body() body: GenerateSessionQuestionsDto) {
    return this.sessionsService.generateQuestions(sessionId, body);
  }

  @Get(':sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.sessionsService.getSession(sessionId);
  }

  @Patch(':sessionId/status')
  updateSessionStatus(@Param('sessionId') sessionId: string, @Body() body: UpdateSessionStatusDto) {
    return this.sessionsService.updateSessionStatus(sessionId, body);
  }

  @Get(':sessionId/rounds')
  listRounds(@Param('sessionId') sessionId: string) {
    return this.sessionsService.listRounds(sessionId);
  }

  @Post(':sessionId/rounds')
  createRound(@Param('sessionId') sessionId: string, @Body() body: CreateSessionRoundDto) {
    return this.sessionsService.createRound(sessionId, body);
  }

  @Patch(':sessionId/rounds/:roundId/answer')
  submitAnswer(
    @Param('sessionId') sessionId: string,
    @Param('roundId') roundId: string,
    @Body() body: SubmitSessionAnswerDto,
  ) {
    return this.sessionsService.submitAnswer(sessionId, roundId, body);
  }

  @Get(':sessionId/progress')
  getSessionProgress(@Param('sessionId') sessionId: string) {
    return this.sessionsService.getSessionProgress(sessionId);
  }

  @Get(':sessionId/review')
  getSessionReview(@Param('sessionId') sessionId: string) {
    return this.sessionsService.getSessionReview(sessionId);
  }
}
