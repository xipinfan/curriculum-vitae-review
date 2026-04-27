import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { ModelConfigsModule } from './model-configs/model-configs.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResumesModule } from './resumes/resumes.module';
import { SessionsModule } from './sessions/sessions.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    WorkspacesModule,
    ModelConfigsModule,
    ResumesModule,
    DiagnosisModule,
    SessionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
