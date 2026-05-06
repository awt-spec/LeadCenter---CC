import type { AuditFilters } from './queries';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function parseAuditFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): AuditFilters {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
    const v = sp[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const getAll = (k: string): string[] => {
    if (sp instanceof URLSearchParams) return sp.getAll(k);
    const v = sp[k];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v) return [v];
    return [];
  };

  const pageRaw = parseInt(get('page') ?? '1', 10);
  const pageSizeRaw = parseInt(get('pageSize') ?? `${DEFAULT_PAGE_SIZE}`, 10);

  const reviewRaw = get('reviewState');
  const reviewState: 'reviewed' | 'unreviewed' | 'all' | undefined =
    reviewRaw === 'reviewed' || reviewRaw === 'unreviewed' || reviewRaw === 'all'
      ? reviewRaw
      : undefined;

  return {
    userId: getAll('userId').filter(Boolean),
    action: getAll('action').filter(Boolean),
    resource: getAll('resource').filter(Boolean),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
    q: get('q')?.trim() || undefined,
    reviewState,
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
    pageSize:
      Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
        ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}
