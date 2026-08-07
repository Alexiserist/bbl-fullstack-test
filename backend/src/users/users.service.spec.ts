import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';

const identity = {
  authIssuer: 'https://tenant.example.test/',
  authSubject: 'auth0|subject',
};

const createdUser = {
  id: '11111111-1111-4111-8111-111111111111',
  ...identity,
  email: null,
  name: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('enriches a newly provisioned user once from /userinfo', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue(createdUser),
        update: jest.fn().mockResolvedValue({ ...createdUser, email: 'person@example.test', name: 'Person' }),
      },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ email: ' person@example.test ', name: ' Person ' }),
    }) as never;
    const service = new UsersService(prisma as never, config());

    await expect(service.resolveOrCreate(identity.authIssuer, identity.authSubject, 'token', 'https://tenant.example.test/userinfo')).resolves.toMatchObject({
      email: 'person@example.test',
      name: 'Person',
    });
    expect(global.fetch).toHaveBeenCalledWith('https://tenant.example.test/userinfo', expect.objectContaining({
      headers: { Authorization: 'Bearer token' },
      signal: expect.any(AbortSignal),
    }));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: createdUser.id },
      data: { email: 'person@example.test', name: 'Person' },
    });
  });

  it('continues with nullable profile fields when /userinfo fails', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue(createdUser),
        update: jest.fn(),
      },
    };
    global.fetch = jest.fn().mockRejectedValue(new Error('network failure')) as never;
    const service = new UsersService(prisma as never, config());

    await expect(service.resolveOrCreate(identity.authIssuer, identity.authSubject, 'token', 'https://tenant.example.test/userinfo')).resolves.toBe(createdUser);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not call /userinfo again for an existing local user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(createdUser),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    global.fetch = jest.fn() as never;
    const service = new UsersService(prisma as never, config());

    await expect(service.resolveOrCreate(identity.authIssuer, identity.authSubject, 'token', 'https://tenant.example.test/userinfo')).resolves.toBe(createdUser);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  function config() {
    return { get: (key: string) => (key === 'USERINFO_TIMEOUT_MS' ? '1500' : undefined) } as unknown as ConfigService;
  }
});
