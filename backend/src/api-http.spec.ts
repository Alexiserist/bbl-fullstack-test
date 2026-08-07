import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BookmarksController } from './bookmarks/bookmarks.controller';
import { BookmarksService } from './bookmarks/bookmarks.service';
import { CollectionsController } from './collections/collections.controller';
import { CollectionsService } from './collections/collections.service';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { SuccessEnvelopeInterceptor } from './common/interceptors/success-envelope.interceptor';
import { MeController } from './me/me.controller';
import { PrismaService } from './prisma/prisma.service';
import { UsersService } from './users/users.service';

const owner = {
  id: '11111111-1111-4111-8111-111111111111',
  authIssuer: 'https://tenant.example.test/',
  authSubject: 'auth0|subject',
  email: null,
  name: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const collectionId = '22222222-2222-4222-8222-222222222222';
const missingId = '33333333-3333-4333-8333-333333333333';

const notFoundBody = {
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Resource not found',
  details: [],
};

describe('HTTP API contract', () => {
  let app: INestApplication;
  let prisma: {
    collection: Record<string, jest.Mock>;
    bookmark: Record<string, jest.Mock>;
  };
  const auth = {
    authenticate: jest.fn().mockResolvedValue({ localUser: owner, claims: {} }),
  };
  const users = {
    toProfile: jest.fn((user: typeof owner) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
  };

  beforeAll(async () => {
    prisma = {
      collection: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      bookmark: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionsController, BookmarksController, MeController],
      providers: [
        CollectionsService,
        BookmarksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }));
    app.useGlobalGuards(new AuthGuard(auth as never));
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new SuccessEnvelopeInterceptor(app.get(Reflector)));
    await app.init();
  });

  beforeEach(() => {
    for (const methods of Object.values(prisma)) {
      for (const method of Object.values(methods)) method.mockReset();
    }
    auth.authenticate.mockReset().mockResolvedValue({ localUser: owner, claims: {} });
    users.toProfile.mockClear();
    prisma.collection.count.mockResolvedValue(0);
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.collection.findFirst.mockResolvedValue(null);
    prisma.collection.create.mockResolvedValue({ id: collectionId, name: 'Work', ownerId: owner.id, createdAt: new Date(), updatedAt: new Date() });
    prisma.collection.updateMany.mockResolvedValue({ count: 1 });
    prisma.collection.deleteMany.mockResolvedValue({ count: 1 });
    prisma.bookmark.count.mockResolvedValue(0);
    prisma.bookmark.findMany.mockResolvedValue([]);
    prisma.bookmark.findFirst.mockResolvedValue(null);
    prisma.bookmark.create.mockResolvedValue({ id: collectionId, url: 'https://example.com', title: 'Example', notes: null, collectionId: null, ownerId: owner.id, createdAt: new Date(), updatedAt: new Date() });
    prisma.bookmark.updateMany.mockResolvedValue({ count: 1 });
    prisma.bookmark.deleteMany.mockResolvedValue({ count: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication on every API route and method', async () => {
    const routes = [
      ['get', '/me'],
      ['get', '/collections'],
      ['post', '/collections'],
      ['get', `/collections/${collectionId}`],
      ['put', `/collections/${collectionId}`],
      ['patch', `/collections/${collectionId}`],
      ['delete', `/collections/${collectionId}`],
      ['get', `/collections/${collectionId}/bookmarks`],
      ['get', '/bookmarks'],
      ['post', '/bookmarks'],
      ['get', `/bookmarks/${collectionId}`],
      ['put', `/bookmarks/${collectionId}`],
      ['patch', `/bookmarks/${collectionId}`],
      ['delete', `/bookmarks/${collectionId}`],
    ] as const;

    for (const [method, path] of routes) {
      auth.authenticate.mockRejectedValueOnce(new UnauthorizedException());
      const response = await request(app.getHttpServer())[method](path);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        details: [],
      });
    }
    expect(auth.authenticate).toHaveBeenCalledTimes(routes.length);
  });

  it('returns only the documented current-user profile fields', async () => {
    const response = await request(app.getHttpServer()).get('/me').set('Authorization', 'Bearer valid');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      statusCode: 200,
      message: 'User retrieved',
      data: {
        id: owner.id,
        email: null,
        name: null,
        createdAt: owner.createdAt.toISOString(),
        updatedAt: owner.updatedAt.toISOString(),
      },
    });
    expect(response.body.data).not.toHaveProperty('authIssuer');
    expect(response.body.data).not.toHaveProperty('authSubject');
  });

  it('wraps list successes and keeps body status equal to HTTP status', async () => {
    prisma.collection.count.mockResolvedValue(21);
    prisma.collection.findMany.mockResolvedValue([]);
    const response = await request(app.getHttpServer()).get('/collections?page=2&pageSize=20');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      statusCode: 200,
      message: 'Collections retrieved',
      data: [],
      meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    });
    expect(prisma.collection.count).toHaveBeenCalledWith({ where: { ownerId: owner.id } });
  });

  it('uses 201 for creates and derives the envelope status from the response', async () => {
    const response = await request(app.getHttpServer()).post('/collections').send({ name: 'Work' });
    expect(response.status).toBe(201);
    expect(response.body.statusCode).toBe(201);
    expect(response.body.message).toBe('Collection created');
    expect(response.body.data).toEqual(expect.objectContaining({ name: 'Work', ownerId: owner.id }));
    expect(prisma.collection.create).toHaveBeenCalledWith({ data: { name: 'Work', ownerId: owner.id } });
  });

  it('returns the generic 404 envelope for missing direct resources', async () => {
    const missing = await request(app.getHttpServer()).get(`/collections/${missingId}`);
    const otherOwner = await request(app.getHttpServer()).get(`/collections/${collectionId}`);
    expect(missing.status).toBe(404);
    expect(otherOwner.status).toBe(404);
    expect(missing.body).toEqual(notFoundBody);
    expect(otherOwner.body).toEqual(missing.body);
    expect(prisma.collection.findFirst).toHaveBeenNthCalledWith(1, { where: { id: missingId, ownerId: owner.id } });
    expect(prisma.collection.findFirst).toHaveBeenNthCalledWith(2, { where: { id: collectionId, ownerId: owner.id } });
  });

  it('returns 200 with data null for deletes', async () => {
    const response = await request(app.getHttpServer()).delete(`/collections/${collectionId}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ statusCode: 200, message: 'Collection deleted', data: null });
    expect(prisma.collection.deleteMany).toHaveBeenCalledWith({ where: { id: collectionId, ownerId: owner.id } });
  });

  it('rejects server-controlled fields without echoing their values', async () => {
    const response = await request(app.getHttpServer())
      .post('/collections')
      .send({ name: 'Private', ownerId: 'secret-owner-value' });
    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(response.status);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toBe('Request validation failed');
    expect(response.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'ownerId' })]));
    expect(JSON.stringify(response.body)).not.toContain('secret-owner-value');
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported nested query parameters', async () => {
    const response = await request(app.getHttpServer()).get(`/collections/${collectionId}/bookmarks?collectionId=${collectionId}`);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed' }));
  });

  it('uses the identical privacy-preserving 404 for missing and other-owner IDs on every protected path', async () => {
    prisma.collection.deleteMany.mockResolvedValue({ count: 0 });
    prisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });

    const scenarios = [
      { method: 'get', path: (id: string) => `/collections/${id}` },
      { method: 'put', path: (id: string) => `/collections/${id}`, body: { name: 'Updated' } },
      { method: 'patch', path: (id: string) => `/collections/${id}`, body: { name: 'Updated' } },
      { method: 'delete', path: (id: string) => `/collections/${id}` },
      { method: 'get', path: (id: string) => `/collections/${id}/bookmarks` },
      { method: 'get', path: (id: string) => `/bookmarks/${id}` },
      { method: 'put', path: (id: string) => `/bookmarks/${id}`, body: { url: 'https://example.test', title: 'Updated' } },
      { method: 'patch', path: (id: string) => `/bookmarks/${id}`, body: { title: 'Updated' } },
      { method: 'delete', path: (id: string) => `/bookmarks/${id}` },
      { method: 'get', path: (id: string) => `/bookmarks?collectionId=${id}` },
      { method: 'post', path: () => '/bookmarks', body: (id: string) => ({ url: 'https://example.test', title: 'Private relation', collectionId: id }) },
    ] as const;

    for (const scenario of scenarios) {
      const execute = (id: string) => {
        const call = request(app.getHttpServer())[scenario.method](scenario.path(id));
        if (!('body' in scenario)) return call;
        const body = typeof scenario.body === 'function' ? scenario.body(id) : scenario.body;
        return call.send(body);
      };
      const missing = await execute(missingId);
      const otherOwner = await execute(collectionId);
      expect(missing.status).toBe(404);
      expect(otherOwner.status).toBe(404);
      expect(missing.body).toEqual(notFoundBody);
      expect(otherOwner.body).toEqual(missing.body);
    }
  });

  it.each(['javascript:', 'data:', 'file:', 'vbscript:'])(
    'rejects the disallowed %s bookmark URL scheme without writing',
    async (scheme) => {
      const response = await request(app.getHttpServer())
        .post('/bookmarks')
        .send({ url: `${scheme}payload`, title: 'Unsafe' });
      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      }));
      expect(prisma.bookmark.create).not.toHaveBeenCalled();
    },
  );

  it.each(['id', 'ownerId', 'createdAt', 'updatedAt', 'unexpected'])(
    'rejects the unknown or server-controlled bookmark field %s',
    async (field) => {
      const secret = `private-${field}-value`;
      const response = await request(app.getHttpServer())
        .post('/bookmarks')
        .send({ url: 'https://example.test', title: 'Example', [field]: secret });
      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(expect.arrayContaining([
        expect.objectContaining({ field }),
      ]));
      expect(JSON.stringify(response.body)).not.toContain(secret);
      expect(prisma.bookmark.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    '/collections?page=0',
    '/collections?page=1.5',
    '/collections?pageSize=101',
    '/bookmarks?page=not-a-number',
    '/bookmarks?uncategorized=false',
    `/bookmarks?collectionId=${collectionId}&uncategorized=true`,
    `/collections/${collectionId}/bookmarks?name=unsupported`,
  ])('rejects invalid list parameters for %s', async (path) => {
    const response = await request(app.getHttpServer()).get(path);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    }));
  });

  it.each([
    '/collections/not-a-uuid',
    '/collections/not-a-uuid/bookmarks',
    '/bookmarks/not-a-uuid',
  ])('rejects malformed route identifiers for %s', async (path) => {
    const response = await request(app.getHttpServer()).get(path);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    }));
  });

  it('accepts documented maximum field lengths and pagination boundaries', async () => {
    const urlPrefix = 'https://example.test/';
    const url = `${urlPrefix}${'a'.repeat(2048 - urlPrefix.length)}`;
    const title = 't'.repeat(300);
    const notes = 'n'.repeat(10_000);
    const collectionName = 'c'.repeat(100);

    const bookmark = await request(app.getHttpServer())
      .post('/bookmarks')
      .send({ url, title, notes, collectionId: null });
    const collection = await request(app.getHttpServer())
      .post('/collections')
      .send({ name: collectionName });
    const minimumPage = await request(app.getHttpServer()).get('/collections?page=1&pageSize=1');
    const maximumPage = await request(app.getHttpServer()).get('/bookmarks?page=1&pageSize=100');

    expect(bookmark.status).toBe(201);
    expect(collection.status).toBe(201);
    expect(minimumPage.status).toBe(200);
    expect(minimumPage.body.meta).toEqual({ page: 1, pageSize: 1, total: 0, totalPages: 0 });
    expect(maximumPage.status).toBe(200);
    expect(maximumPage.body.meta).toEqual({ page: 1, pageSize: 100, total: 0, totalPages: 0 });
    expect(prisma.bookmark.create).toHaveBeenCalledWith({
      data: { url, title, notes, collectionId: null, ownerId: owner.id },
    });
    expect(prisma.collection.create).toHaveBeenCalledWith({
      data: { name: collectionName, ownerId: owner.id },
    });
  });

  it.each([
    ['/collections', { name: ' ' }],
    ['/collections', { name: 'c'.repeat(101) }],
    ['/bookmarks', { url: 'https://example.test', title: ' ' }],
    ['/bookmarks', { url: 'https://example.test', title: 't'.repeat(301) }],
    ['/bookmarks', { url: 'https://example.test', title: 'Example', notes: 'n'.repeat(10_001) }],
    ['/bookmarks', { url: 'https://example.test', title: 'Example', collectionId: 'not-a-uuid' }],
  ])('rejects blank, over-limit, or malformed resource input for %s', async (path, body) => {
    const response = await request(app.getHttpServer()).post(path).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    }));
  });
});
