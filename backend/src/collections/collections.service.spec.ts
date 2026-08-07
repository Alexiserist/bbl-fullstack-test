import { NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherOwnerCollectionId = '22222222-2222-4222-8222-222222222222';

describe('CollectionsService', () => {
  it('uses owner-first filters and deterministic list ordering', async () => {
    const prisma = {
      collection: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new CollectionsService(prisma as never);

    await service.findAll(ownerId, { name: ' work ', page: 2, pageSize: 10 });

    expect(prisma.collection.count).toHaveBeenCalledWith({
      where: { ownerId, name: { contains: 'work', mode: 'insensitive' } },
    });
    expect(prisma.collection.findMany).toHaveBeenCalledWith({
      where: { ownerId, name: { contains: 'work', mode: 'insensitive' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
  });

  it('returns the privacy-preserving not-found branch for an inaccessible collection', async () => {
    const prisma = { collection: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CollectionsService(prisma as never);

    await expect(service.findOne(ownerId, otherOwnerCollectionId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.collection.findFirst).toHaveBeenCalledWith({
      where: { id: otherOwnerCollectionId, ownerId },
    });
  });

  it('deletes only the owner-scoped collection and relies on the FK SET NULL action', async () => {
    const prisma = { collection: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new CollectionsService(prisma as never);

    await expect(service.remove(ownerId, otherOwnerCollectionId)).resolves.toBeNull();
    expect(prisma.collection.deleteMany).toHaveBeenCalledWith({
      where: { id: otherOwnerCollectionId, ownerId },
    });
  });

  it('does not turn a failed owner-scoped delete into a success', async () => {
    const prisma = { collection: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new CollectionsService(prisma as never);

    await expect(service.remove(ownerId, otherOwnerCollectionId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
