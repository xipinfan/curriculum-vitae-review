import { DiagnosisJobStatus } from '@prisma/client';
import { DiagnosisAgentService } from '../src/diagnosis/diagnosis-agent.service';
import { DiagnosisEventsService } from '../src/diagnosis/diagnosis-events.service';
import { DiagnosisService } from '../src/diagnosis/diagnosis.service';
import { PrismaService } from '../src/prisma/prisma.service';

type JobRecord = {
  id: string;
  status: DiagnosisJobStatus;
  errorMessage: string | null;
  completedAt: Date | null;
};

function createServiceWithJobs(initialJobs: JobRecord[]) {
  const jobs = initialJobs.map((job) => ({ ...job }));

  const prismaMock = {
    diagnosisJob: {
      updateMany: jest.fn().mockImplementation(async ({ where, data }: { where?: { status?: DiagnosisJobStatus }; data: Partial<JobRecord> }) => {
        let count = 0;
        jobs.forEach((job) => {
          if (!where?.status || job.status === where.status) {
            job.status = data.status ?? job.status;
            job.errorMessage = data.errorMessage ?? job.errorMessage;
            job.completedAt = data.completedAt ?? job.completedAt;
            count += 1;
          }
        });
        return { count };
      }),
    },
  } as unknown as PrismaService;

  const eventsMock = {} as DiagnosisEventsService;
  const agentMock = {} as DiagnosisAgentService;

  return {
    jobs,
    service: new DiagnosisService(prismaMock, eventsMock, agentMock),
  };
}

describe('DiagnosisService job recovery', () => {
  it('marks interrupted running jobs as failed on boot', async () => {
    const { jobs, service } = createServiceWithJobs([
      {
        id: 'job-running',
        status: DiagnosisJobStatus.RUNNING,
        errorMessage: null,
        completedAt: null,
      },
      {
        id: 'job-completed',
        status: DiagnosisJobStatus.COMPLETED,
        errorMessage: null,
        completedAt: new Date('2026-04-26T16:00:00.000Z'),
      },
    ]);

    await service.onModuleInit();

    expect(jobs[0].status).toBe(DiagnosisJobStatus.FAILED);
    expect(jobs[0].errorMessage).toContain('服务重启');
    expect(jobs[0].completedAt).toBeInstanceOf(Date);
    expect(jobs[1].status).toBe(DiagnosisJobStatus.COMPLETED);
  });
});
