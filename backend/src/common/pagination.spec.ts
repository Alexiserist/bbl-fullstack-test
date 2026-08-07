import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  makePageMeta,
  resolvePagination,
} from './pagination';

describe('pagination helpers', () => {
  it('uses the documented defaults and offset', () => {
    expect(resolvePagination({})).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it('calculates an offset for a later page', () => {
    expect(resolvePagination({ page: 3, pageSize: 20 })).toEqual({
      page: 3,
      pageSize: 20,
      skip: 40,
      take: 20,
    });
  });

  it('reports zero pages for an empty result and rounds up otherwise', () => {
    expect(makePageMeta(1, 20, 0)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect(makePageMeta(2, 20, 21)).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
  });
});
