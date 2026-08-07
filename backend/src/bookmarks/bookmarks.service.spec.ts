import { NotFoundException } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherCollectionId = '22222222-2222-4222-8222-222222222222';

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
});
