import { NotFoundException } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherCollectionId = '22222222-2222-4222-8222-222222222222';
const bookmarkId = '33333333-3333-4333-8333-333333333333';

const existingBookmark = {
  id: bookmarkId,
  url: 'https://old.example.test',
  title: 'Old title',
  notes: 'Old notes',
  collectionId: otherCollectionId,
  ownerId,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

describe('BookmarksService', () => {
  it('rejects creating a bookmark in another owner\'s collection', async () => {
    const prisma = {
      collection: { findFirst: jest.fn().mockResolvedValue(null) },
      bookmark: { create: jest.fn() },
    };
    const service = new BookmarksService(prisma as never);

    await expect(service.create(ownerId, {
      url: 'https://example.com/private',
      title: 'Private',
      collectionId: otherCollectionId,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.collection.findFirst).toHaveBeenCalledWith({
      where: { id: otherCollectionId, ownerId },
      select: { id: true },
    });
    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });

  it('rejects a collection filter that is not owned by the requester', async () => {
    const prisma = {
      collection: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookmarksService(prisma as never);

    await expect(
      service.findAll(ownerId, {
        collectionId: otherCollectionId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.collection.findFirst).toHaveBeenCalledWith({
      where: { id: otherCollectionId, ownerId },
      select: { id: true },
    });
  });

  it('scopes uncategorized results to the authenticated owner', async () => {
    const prisma = {
      bookmark: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BookmarksService(prisma as never);

    await service.findAll(ownerId, { uncategorized: 'true' });

    expect(prisma.bookmark.count).toHaveBeenCalledWith({
      where: { ownerId, collectionId: null },
    });
    expect(prisma.bookmark.findMany).toHaveBeenCalledWith({
      where: { ownerId, collectionId: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
  });

  it('rejects an empty patch before touching persistence', async () => {
    const prisma = { bookmark: { findFirst: jest.fn() } };
    const service = new BookmarksService(prisma as never);

    await expect(service.patch(ownerId, otherCollectionId, {})).rejects.toThrow();
    expect(prisma.bookmark.findFirst).not.toHaveBeenCalled();
  });

  it('keeps bookmark-by-collection counts owner-scoped after resolving the parent', async () => {
    const prisma = {
      collection: { findFirst: jest.fn().mockResolvedValue({ id: otherCollectionId }) },
      bookmark: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BookmarksService(prisma as never);

    await service.findByCollection(ownerId, otherCollectionId, {});

    expect(prisma.bookmark.count).toHaveBeenCalledWith({
      where: { ownerId, collectionId: otherCollectionId },
    });
    expect(prisma.bookmark.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId, collectionId: otherCollectionId },
    }));
  });

  it('normalizes omitted or blank nullable fields during create', async () => {
    const created = { ...existingBookmark, notes: null, collectionId: null };
    const prisma = { bookmark: { create: jest.fn().mockResolvedValue(created) } };
    const service = new BookmarksService(prisma as never);

    await service.create(ownerId, {
      url: 'https://example.test',
      title: 'Example',
      notes: '   ',
    });

    expect(prisma.bookmark.create).toHaveBeenCalledWith({
      data: {
        url: 'https://example.test',
        title: 'Example',
        notes: null,
        collectionId: null,
        ownerId,
      },
    });
  });

  it('implements PUT as full writable replacement and clears omitted nullable fields', async () => {
    const replaced = {
      ...existingBookmark,
      url: 'https://new.example.test',
      title: 'New title',
      notes: null,
      collectionId: null,
    };
    const prisma = {
      bookmark: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(existingBookmark)
          .mockResolvedValueOnce(replaced),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new BookmarksService(prisma as never);

    await expect(service.replace(ownerId, bookmarkId, {
      url: replaced.url,
      title: replaced.title,
    })).resolves.toBe(replaced);

    expect(prisma.bookmark.updateMany).toHaveBeenCalledWith({
      where: { id: bookmarkId, ownerId },
      data: {
        url: replaced.url,
        title: replaced.title,
        notes: null,
        collectionId: null,
      },
    });
  });

  it('implements PATCH as a partial update that preserves omitted fields', async () => {
    const patched = { ...existingBookmark, title: 'Patched title' };
    const prisma = {
      bookmark: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(existingBookmark)
          .mockResolvedValueOnce(patched),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new BookmarksService(prisma as never);

    await expect(service.patch(ownerId, bookmarkId, { title: patched.title })).resolves.toBe(patched);
    expect(prisma.bookmark.updateMany).toHaveBeenCalledWith({
      where: { id: bookmarkId, ownerId },
      data: { title: patched.title },
    });
  });

  it('allows PATCH to explicitly clear both nullable fields', async () => {
    const patched = { ...existingBookmark, notes: null, collectionId: null };
    const prisma = {
      bookmark: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(existingBookmark)
          .mockResolvedValueOnce(patched),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new BookmarksService(prisma as never);

    await service.patch(ownerId, bookmarkId, { notes: null, collectionId: null });
    expect(prisma.bookmark.updateMany).toHaveBeenCalledWith({
      where: { id: bookmarkId, ownerId },
      data: { notes: null, collectionId: null },
    });
  });

  it('rejects PATCH assignment to another owner\'s collection before writing', async () => {
    const prisma = {
      bookmark: {
        findFirst: jest.fn().mockResolvedValue(existingBookmark),
        updateMany: jest.fn(),
      },
      collection: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookmarksService(prisma as never);

    await expect(service.patch(ownerId, bookmarkId, {
      collectionId: otherCollectionId,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.collection.findFirst).toHaveBeenCalledWith({
      where: { id: otherCollectionId, ownerId },
      select: { id: true },
    });
    expect(prisma.bookmark.updateMany).not.toHaveBeenCalled();
  });

  it('scopes bookmark deletion by both resource and owner IDs', async () => {
    const prisma = { bookmark: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new BookmarksService(prisma as never);

    await expect(service.remove(ownerId, bookmarkId)).resolves.toBeNull();
    expect(prisma.bookmark.deleteMany).toHaveBeenCalledWith({
      where: { id: bookmarkId, ownerId },
    });
  });

  it('returns requested-page metadata and an empty array beyond available results', async () => {
    const prisma = {
      bookmark: {
        count: jest.fn().mockResolvedValue(21),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BookmarksService(prisma as never);

    await expect(service.findAll(ownerId, { page: 3, pageSize: 10 })).resolves.toEqual({
      items: [],
      meta: { page: 3, pageSize: 10, total: 21, totalPages: 3 },
    });
    expect(prisma.bookmark.findMany).toHaveBeenCalledWith({
      where: { ownerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 10,
    });
  });

  it('keeps the nested route equivalent to the collectionId filter', async () => {
    const item = { ...existingBookmark, collectionId: otherCollectionId };
    const prisma = {
      collection: { findFirst: jest.fn().mockResolvedValue({ id: otherCollectionId }) },
      bookmark: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([item]),
      },
    };
    const service = new BookmarksService(prisma as never);

    const filtered = await service.findAll(ownerId, {
      collectionId: otherCollectionId,
      page: 2,
      pageSize: 5,
    });
    const nested = await service.findByCollection(ownerId, otherCollectionId, {
      page: 2,
      pageSize: 5,
    });

    expect(nested).toEqual(filtered);
    expect(prisma.bookmark.findMany).toHaveBeenNthCalledWith(1, {
      where: { ownerId, collectionId: otherCollectionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 5,
      take: 5,
    });
    expect(prisma.bookmark.findMany).toHaveBeenNthCalledWith(2, {
      where: { ownerId, collectionId: otherCollectionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 5,
      take: 5,
    });
  });
});
