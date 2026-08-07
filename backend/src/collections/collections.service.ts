import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Collection, Prisma } from '@prisma/client';
import { CreateCollectionDto, PatchCollectionDto, CollectionListQueryDto } from './dto/collection.dto';
import { PrismaService } from '../prisma/prisma.service';
import { makePageMeta, resolvePagination } from '../common/pagination';
import { paginated } from '../common/api-response';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateCollectionDto) {
    return this.prisma.collection.create({
      data: { name: dto.name, ownerId },
    });
  }

  async findAll(ownerId: string, query: CollectionListQueryDto) {
    const pagination = resolvePagination(query);
    const name = query.name?.trim();
    const where: Prisma.CollectionWhereInput = {
      ownerId,
      ...(name
        ? { name: { contains: name, mode: 'insensitive' } }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.collection.count({ where }),
      this.prisma.collection.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);
    return paginated(items, makePageMeta(pagination.page, pagination.pageSize, total));
  }

  async findOne(ownerId: string, id: string): Promise<Collection> {
    const collection = await this.prisma.collection.findFirst({ where: { id, ownerId } });
    if (!collection) throw new NotFoundException();
    return collection;
  }

  async replace(ownerId: string, id: string, dto: CreateCollectionDto) {
    await this.findOne(ownerId, id);
    const result = await this.prisma.collection.updateMany({
      where: { id, ownerId },
      data: { name: dto.name },
    });
    if (result.count !== 1) throw new NotFoundException();
    return this.findOne(ownerId, id);
  }

  async patch(ownerId: string, id: string, dto: PatchCollectionDto) {
    if (Object.keys(dto).length === 0) throw new BadRequestException();
    await this.findOne(ownerId, id);
    const result = await this.prisma.collection.updateMany({
      where: { id, ownerId },
      data: { name: dto.name },
    });
    if (result.count !== 1) throw new NotFoundException();
    return this.findOne(ownerId, id);
  }

  async remove(ownerId: string, id: string): Promise<null> {
    const result = await this.prisma.collection.deleteMany({ where: { id, ownerId } });
    if (result.count !== 1) throw new NotFoundException();
    return null;
  }
}
