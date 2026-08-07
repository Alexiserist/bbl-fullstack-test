import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userA = await prisma.user.upsert({
    where: {
      authIssuer_authSubject: {
        authIssuer: 'https://seed.example.test/tenant-a',
        authSubject: 'seed-user-a',
      },
    },
    update: { email: 'seed-a@example.test', name: 'Seed User A' },
    create: {
      authIssuer: 'https://seed.example.test/tenant-a',
      authSubject: 'seed-user-a',
      email: 'seed-a@example.test',
      name: 'Seed User A',
    },
  });

  const userB = await prisma.user.upsert({
    where: {
      authIssuer_authSubject: {
        authIssuer: 'https://seed.example.test/tenant-b',
        authSubject: 'seed-user-b',
      },
    },
    update: { email: 'seed-b@example.test', name: 'Seed User B' },
    create: {
      authIssuer: 'https://seed.example.test/tenant-b',
      authSubject: 'seed-user-b',
      email: 'seed-b@example.test',
      name: 'Seed User B',
    },
  });

  const collectionA = await findOrCreateCollection(userA.id, 'User A Work');
  await findOrCreateCollection(userA.id, 'User A Empty');
  const collectionB = await findOrCreateCollection(userB.id, 'User B Personal');

  await findOrCreateBookmark(userA.id, 'https://example.com/user-a/work', 'User A Work Bookmark', collectionA.id);
  await findOrCreateBookmark(userA.id, 'https://example.com/user-a/uncategorized', 'User A Uncategorized Bookmark');
  await findOrCreateBookmark(userB.id, 'https://example.com/user-b/personal', 'User B Personal Bookmark', collectionB.id);
  await findOrCreateBookmark(userB.id, 'https://example.com/user-b/uncategorized', 'User B Uncategorized Bookmark');
}

async function findOrCreateCollection(ownerId: string, name: string) {
  const existing = await prisma.collection.findFirst({ where: { ownerId, name } });
  return existing ?? prisma.collection.create({ data: { name, ownerId } });
}

async function findOrCreateBookmark(
  ownerId: string,
  url: string,
  title: string,
  collectionId?: string,
) {
  const existing = await prisma.bookmark.findFirst({ where: { ownerId, url, title } });
  return (
    existing ??
    prisma.bookmark.create({
      data: { ownerId, url, title, collectionId: collectionId ?? null },
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
