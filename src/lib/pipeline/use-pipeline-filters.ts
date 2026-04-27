'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
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

export function usePipelineFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(() => parsePipelineFilters(params), [params]);

  const update = useCallback(
    (next: Record<string, string | string[] | boolean | number | null | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        sp.delete(k);
        if (v === null || v === undefined || v === '' || v === false) continue;
        if (Array.isArray(v)) v.forEach((val) => sp.append(k, val));
        else sp.set(k, String(v));
      }
      startTransition(() => router.push(`/pipeline?${sp.toString()}`));
    },
    [params, router]
  );

  const toggleArray = useCallback(
    (key: string, value: string) => {
      const current = params.getAll(key);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      update({ [key]: next });
    },
    [params, update]
  );

  const clear = useCallback(() => {
    startTransition(() => router.push('/pipeline'));
  }, [router]);

  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.product?.length ?? 0) +
    (filters.ownerId?.length ?? 0) +
    (filters.rating?.length ?? 0) +
    (filters.country?.length ?? 0) +
    (filters.segment?.length ?? 0) +
    (filters.commercialModel?.length ?? 0) +
    (filters.onlyMine ? 1 : 0) +
    (filters.overdueNextAction ? 1 : 0) +
    (filters.stale7d ? 1 : 0) +
    (filters.minValue !== undefined ? 1 : 0) +
    (filters.maxValue !== undefined ? 1 : 0) +
    (filters.closeFrom ? 1 : 0) +
    (filters.closeTo ? 1 : 0);

  return { filters, update, toggleArray, clear, activeCount, isPending };
}
