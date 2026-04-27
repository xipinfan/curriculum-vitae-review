import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { WorkspaceKeysController } from '../src/workspaces/workspace-keys.controller';
import { WorkspaceKeysService } from '../src/workspaces/workspace-keys.service';

describe('App E2E', () => {
  let app: INestApplication;

  const workspaceKeysServiceMock = {
    async validate(accessKey: string) {
      if (accessKey === 'valid-key-001') {
        return {
          valid: true,
          workspaceId: 'workspace-test-001',
          workspaceName: 'Test Workspace',
        };
      }
      return {
        valid: false,
        workspaceId: null,
        workspaceName: null,
      };
    },
    async createWorkspace() {
      return {
        id: 'workspace-test-001',
        name: 'Test Workspace',
        accessKey: 'valid-key-001',
        status: 'ACTIVE',
        createdAt: new Date('2026-04-26T00:00:00.000Z'),
      };
    },
    async listWorkspaces() {
      return [
        {
          id: 'workspace-test-001',
          name: 'Test Workspace',
          status: 'ACTIVE',
          createdAt: new Date('2026-04-26T00:00:00.000Z'),
        },
      ];
    },
  } as unknown as WorkspaceKeysService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, WorkspaceKeysController],
      providers: [
        {
          provide: WorkspaceKeysService,
          useValue: workspaceKeysServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('cv-review-api');
  });

  it('GET /api/v1/workspaces/validate-key/:accessKey validates key', async () => {
    const ok = await request(app.getHttpServer()).get('/api/v1/workspaces/validate-key/valid-key-001').expect(200);
    expect(ok.body.valid).toBe(true);
    expect(ok.body.workspaceId).toBe('workspace-test-001');

    const bad = await request(app.getHttpServer()).get('/api/v1/workspaces/validate-key/invalid-key').expect(200);
    expect(bad.body.valid).toBe(false);
  });
});
