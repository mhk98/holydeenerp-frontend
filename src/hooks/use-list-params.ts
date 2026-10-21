import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface ListState {
  page: number;
  limit: number;
  /** "field" or "-field" */
  sort: string;
  search: string;
  filters: Record<string, string>;
}

interface Options {
  defaultSort?: string;
  defaultLimit?: number;
  /** Query-string keys treated as filters. */
  filterKeys?: string[];
}

/**
 * List state (pagination, sort, search, filters) kept in the URL so it survives
 * reloads and can be shared. Returns the state, a setter and server query params.
 */
export function useListParams({ defaultSort = '', defaultLimit = 20, filterKeys = [] }: Options = {}) {
  const [params, setParams] = useSearchParams();
  const filterKeyList = filterKeys.join(',');

  const state = useMemo<ListState>(() => {
    const filters: Record<string, string> = {};
    for (const key of filterKeyList ? filterKeyList.split(',') : []) {
      const value = params.get(key);
      if (value) filters[key] = value;
    }
    return {
      page: Math.max(1, Number(params.get('page')) || 1),
      limit: Number(params.get('limit')) || defaultLimit,
      sort: params.get('sort') ?? defaultSort,
      search: params.get('search') ?? '',
      filters,
    };
  }, [params, defaultLimit, defaultSort, filterKeyList]);

  const setState = useCallback(
    (patch: Partial<ListState>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const merged = { ...state, ...patch, filters: { ...state.filters, ...patch.filters } };
          // Any change other than paging returns to page 1.
          if (!('page' in patch)) merged.page = 1;
          const set = (key: string, value: string | number, fallback: string | number) =>
            value === fallback || value === '' ? next.delete(key) : next.set(key, String(value));
          set('page', merged.page, 1);
          set('limit', merged.limit, defaultLimit);
          set('sort', merged.sort, defaultSort);
          set('search', merged.search, '');
          for (const [key, value] of Object.entries(merged.filters)) set(key, value, '');
          return next;
        },
        { replace: true },
      );
    },
    [state, setParams, defaultLimit, defaultSort],
  );

  const query = useMemo(
    () => ({
      page: state.page,
      limit: state.limit,
      ...(state.sort && { sort: state.sort }),
      ...(state.search && { search: state.search }),
      ...state.filters,
    }),
    [state],
  );

  return { state, setState, query };
}
