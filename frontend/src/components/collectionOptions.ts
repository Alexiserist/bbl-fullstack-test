import type { ApiEnvelope } from '../api/types';
import type { Collection } from '../api/types';

export type CollectionRequest = <T>(path: string, init?: RequestInit) => Promise<ApiEnvelope<T>>;

/** Load every owned collection in bounded API pages for bookmark selectors. */
export async function fetchAllCollections(request: CollectionRequest): Promise<Collection[]> {
  const all: Collection[] = [];
  let page = 1;
  while (true) {
    const response = await request<Collection[]>(`/collections?page=${page}&pageSize=100`);
    all.push(...response.data);
    const totalPages = response.meta?.totalPages ?? page;
    if (page >= totalPages) return all;
    page += 1;
  }
}
