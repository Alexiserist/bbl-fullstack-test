import type { ApiEnvelope, Bookmark, Collection, PageMeta, Profile } from '../api/types';

export const OWNER_ID = 'owner-1';
export const OTHER_OWNER_ID = 'owner-2';

export function collection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'collection-1',
    name: 'Reading',
    ownerId: OWNER_ID,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

export function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bookmark-1',
    url: 'https://example.com/article',
    title: 'Example article',
    notes: 'A useful note',
    collectionId: 'collection-1',
    ownerId: OWNER_ID,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

export function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: OWNER_ID,
    email: 'owner@example.com',
    name: 'Owner',
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

export function meta(overrides: Partial<PageMeta> = {}): PageMeta {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    ...overrides,
  };
}

export function envelope<T>(data: T, overrides: Partial<ApiEnvelope<T>> = {}): ApiEnvelope<T> {
  return {
    statusCode: 200,
    message: 'OK',
    data,
    ...overrides,
  };
}

export function listEnvelope<T>(data: T[], pageMeta: Partial<PageMeta> = {}): ApiEnvelope<T[]> {
  return envelope(data, {
    message: 'Items retrieved',
    meta: meta({ ...pageMeta, total: pageMeta.total ?? data.length, totalPages: pageMeta.totalPages ?? (data.length ? 1 : 0) }),
  });
}
