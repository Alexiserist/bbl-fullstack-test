import { PrismaClient } from '@prisma/client';

const describeDatabase = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('PostgreSQL/Prisma persistence', () => {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let userAId: string;
  let userBId: string;
  let collectionAId: string;
  let collectionBId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { authIssuer: `https://integration-a.${suffix}.test/`, authSubject: 'user-a' } }),
      prisma.user.create({ data: { authIssuer: `https://integration-b.${suffix}.test/`, authSubject: 'user-b' } }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    const [collectionA, collectionB] = await Promise.all([
      prisma.collection.create({ data: { ownerId: userAId, name: 'A collection' } }),
      prisma.collection.create({ data: { ownerId: userBId, name: 'B collection' } }),
    ]);
    collectionAId = collectionA.id;
    collectionBId = collectionB.id;
  });

  afterAll(async () => {
    if (userAId) await prisma.user.delete({ where: { id: userAId } });
    if (userBId) await prisma.user.delete({ where: { id: userBId } });
    await prisma.$disconnect();
  });

  it('persists owner-scoped rows and preserves a bookmark when its collection is deleted', async () => {
    const [bookmarkA, bookmarkB] = await Promise.all([
      prisma.bookmark.create({ data: { ownerId: userAId, collectionId: collectionAId, url: `https://a.${suffix}.test`, title: 'A bookmark' } }),
      prisma.bookmark.create({ data: { ownerId: userBId, collectionId: collectionBId, url: `https://b.${suffix}.test`, title: 'B bookmark' } }),
    ]);

    await expect(prisma.collection.findFirst({ where: { id: collectionBId, ownerId: userAId } })).resolves.toBeNull();
    await expect(prisma.bookmark.findMany({ where: { ownerId: userAId } })).resolves.toEqual([expect.objectContaining({ id: bookmarkA.id })]);

    await prisma.collection.delete({ where: { id: collectionAId } });
    await expect(prisma.bookmark.findUnique({ where: { id: bookmarkA.id }, select: { collectionId: true } })).resolves.toEqual({ collectionId: null });
    await expect(prisma.bookmark.findUnique({ where: { id: bookmarkB.id }, select: { collectionId: true } })).resolves.toEqual({ collectionId: collectionBId });
  });
});
