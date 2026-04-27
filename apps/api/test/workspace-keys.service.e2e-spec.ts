import { WorkspaceStatus } from '@prisma/client';
import { WorkspaceKeysService } from '../src/workspaces/workspace-keys.service';

describe('WorkspaceKeysService', () => {
  const originalAdminKey = process.env.ADMIN_KEY;

  afterEach(() => {
    process.env.ADMIN_KEY = originalAdminKey;
    jest.restoreAllMocks();
  });

  it('creates a persisted workspace when validating the admin key for the first time', async () => {
    process.env.ADMIN_KEY = 'sk-xipin-admin';

    const prisma = {
      workspace: {
        findFirst: jest.fn().mockResolvedValueOnce(null),
        upsert: jest.fn().mockResolvedValueOnce({
          id: 'workspace-admin-001',
          name: 'Legacy Admin Workspace',
        }),
      },
    };
    const service = new WorkspaceKeysService(prisma as never);

    const result = await service.validate('sk-xipin-admin');

    expect(prisma.workspace.upsert).toHaveBeenCalledWith({
      where: { accessKey: 'sk-xipin-admin' },
      update: { status: WorkspaceStatus.ACTIVE },
      create: {
        name: 'Legacy Admin Workspace',
        accessKey: 'sk-xipin-admin',
        status: WorkspaceStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
      },
    });
    expect(result).toEqual({
      valid: true,
      workspaceId: 'workspace-admin-001',
      workspaceName: 'Legacy Admin Workspace',
    });
  });
});
