import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Bookmark, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { makePageMeta, resolvePagination } from '../common/pagination';
import { paginated } from '../common/api-response';
import {
  BookmarkListQueryDto,
  CreateBookmarkDto,
  NestedBookmarkListQueryDto,
  PatchBookmarkDto,
} from './dto/bookmark.dto';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateBookmarkDto) {
    await this.ensureCollectionOwner(ownerId, dto.collectionId);
    return this.prisma.bookmark.create({
      data: {
        url: dto.url,
        title: dto.title,
        notes: this.normalizeNotes(dto.notes),
        collectionId: dto.collectionId ?? null,
        ownerId,
      },
    });
  }

  async findAll(ownerId: string, query: BookmarkListQueryDto) {
    if (query.collectionId && query.uncategorized !== undefined) {
      throw new BadRequestException();
    }
    if (query.uncategorized !== undefined && query.uncategorized !== 'true') {
      throw new BadRequestException();
    }
    if (query.collectionId) await this.ensureCollectionOwner(ownerId, query.collectionId);

    const pagination = resolvePagination(query);
    const where: Prisma.BookmarkWhereInput = {
      ownerId,
      ...(query.collectionId ? { collectionId: query.collectionId } : {}),
      ...(query.uncategorized === 'true' ? { collectionId: null } : {}),
    };
    return this.findPage(where, pagination.page, pagination.pageSize);
  }

  async findByCollection(ownerId: string, collectionId: string, query: NestedBookmarkListQueryDto) {
    await this.ensureCollectionOwner(ownerId, collectionId);
    const pagination = resolvePagination(query);
    return this.findPage(
      { ownerId, collectionId },
      pagination.page,
      pagination.pageSize,
    );
  }

  async findOne(ownerId: string, id: string): Promise<Bookmark> {
    const bookmark = await this.prisma.bookmark.findFirst({ where: { id, ownerId } });
    if (!bookmark) throw new NotFoundException();
    return bookmark;
  }

  async replace(ownerId: string, id: string, dto: CreateBookmarkDto) {
    await this.findOne(ownerId, id);
    await this.ensureCollectionOwner(ownerId, dto.collectionId);
    const result = await this.prisma.bookmark.updateMany({
      where: { id, ownerId },
      data: {
        url: dto.url,
        title: dto.title,
        notes: this.normalizeNotes(dto.notes),
        collectionId: dto.collectionId ?? null,
      },
    });
    if (result.count !== 1) throw new NotFoundException();
    return this.findOne(ownerId, id);
  }

  async patch(ownerId: string, id: string, dto: PatchBookmarkDto) {
    if (Object.keys(dto).length === 0) throw new BadRequestException();
    await this.findOne(ownerId, id);
    await this.ensureCollectionOwner(ownerId, dto.collectionId);

    const data: Prisma.BookmarkUncheckedUpdateManyInput = {};
    if (dto.url !== undefined) data.url = dto.url;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.notes !== undefined) data.notes = this.normalizeNotes(dto.notes);
    if (dto.collectionId !== undefined) data.collectionId = dto.collectionId;

    const result = await this.prisma.bookmark.updateMany({
      where: { id, ownerId },
      data,
    });
    if (result.count !== 1) throw new NotFoundException();
    return this.findOne(ownerId, id);
  }

  async remove(ownerId: string, id: string): Promise<null> {
    const result = await this.prisma.bookmark.deleteMany({ where: { id, ownerId } });
    if (result.count !== 1) throw new NotFoundException();
    return null;
  }

  private async ensureCollectionOwner(ownerId: string, collectionId?: string | null) {
    if (!collectionId) return;
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, ownerId },
      select: { id: true },
    });
    if (!collection) throw new NotFoundException();
  }

  private normalizeNotes(notes: string | null | undefined): string | null {
    if (notes === null || notes === undefined) return null;
    const normalized = notes.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private async findPage(where: Prisma.BookmarkWhereInput, page: number, pageSize: number) {
    const pagination = resolvePagination({ page, pageSize });
    const [total, items] = await Promise.all([
      this.prisma.bookmark.count({ where }),
      this.prisma.bookmark.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);
    return paginated(items, makePageMeta(page, pageSize, total));
  }
}
