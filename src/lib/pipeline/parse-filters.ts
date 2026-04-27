import type { PipelineFilters } from './queries';

export function parsePipelineFilters(sp: URLSearchParams): PipelineFilters {
  const getArr = (k: string) => {
    const v = sp.getAll(k);
    return v.length ? v : undefined;
  };
  const getNum = (k: string) => {
    const v = sp.get(k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const getBool = (k: string) => sp.get(k) === 'true';

  return {
    q: sp.get('q') ?? undefined,
    product: getArr('product'),
    ownerId: getArr('ownerId'),
    rating: getArr('rating'),
    country: getArr('country'),
    segment: getArr('segment'),
    commercialModel: getArr('commercialModel'),
    minValue: getNum('minValue'),
    maxValue: getNum('maxValue'),
    closeFrom: sp.get('closeFrom') ?? undefined,
    closeTo: sp.get('closeTo') ?? undefined,
    createdFrom: sp.get('createdFrom') ?? undefined,
    createdTo: sp.get('createdTo') ?? undefined,
    onlyMine: getBool('onlyMine'),
    overdueNextAction: getBool('overdueNextAction'),
    stale7d: getBool('stale7d'),
    includeWon: getBool('includeWon'),
    includeLost: getBool('includeLost'),
    includeStandBy: getBool('includeStandBy'),
    includeNurture: getBool('includeNurture'),
  };
}
