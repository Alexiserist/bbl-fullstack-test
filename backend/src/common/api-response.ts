import { SetMetadata } from '@nestjs/common';

export const API_MESSAGE = 'api_message';

export const ApiMessage = (message: string) => SetMetadata(API_MESSAGE, message);

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PageMeta;
}

export const paginated = <T>(items: T[], meta: PageMeta): PaginatedResult<T> => ({
  items,
  meta,
});
