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
import { PrismaService } from './prisma/prisma.service';

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

describe('HTTP API contract', () => {
  let app: INestApplication;
  let prisma: {
    collection: Record<string, jest.Mock>;
    bookmark: Record<string, jest.Mock>;
  };
  const auth = {
    authenticate: jest.fn().mockResolvedValue({ localUser: owner, claims: {} }),
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
      controllers: [CollectionsController, BookmarksController],
      providers: [
        CollectionsService,
        BookmarksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
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
    auth.authenticate.mockClear();
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

  it('requires authentication on the resource routes', async () => {
    auth.authenticate.mockRejectedValueOnce(new UnauthorizedException());
    const response = await request(app.getHttpServer()).get('/collections');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
      details: [],
    });
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
    expect(missing.body).toEqual({ statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found', details: [] });
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
});
