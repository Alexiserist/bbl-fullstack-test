export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: PageMeta;
}

export interface ApiErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details: Array<{ field: string; message: string }>;
}

export interface Collection {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  notes: string | null;
  collectionId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}
