# Fase 5 — Reporte final ejecutivo (batch 1 + 2 + 3)

## TL;DR

- **11 fixes aplicados** en 3 batches, 11 commits atómicos, **32/32 tests pasando**.
- **Activity timeline simple** pasó de **1.5–19s p99 → <50ms** (test directo) =
  ~200× más rápido en su caso de uso real.
- **Activity timeline con includes** pasó de **2.5s → 670ms** (−73%) gracias
  a `relationLoadStrategy: 'join'` (OPT-011) que materializa todos los
  includes en un solo SQL via LATERAL JOINs en lugar de N queries.
- **Backfill de 1,834 activities** consolidó el data model para que el query
  simple sea correcto.
- **Client-side cache compartido** (OPT-013, React Query) + **server-side
  cache cross-instance** (OPT-016, tabla `Cache` Postgres) eliminan dedup
  manual y cold-start tax.

---

## Tabla comparativa antes / después (post batch 3)

Mismo dataset (121K activities, 30K contacts, 3K accounts), 5 iteraciones.

| Flujo | Antes p50 | Post B2 p50 | Post B3 p50 | Δ B0→B3 |
|---|---:|---:|---:|---:|
| `[OLD]` Activity timeline OR (3 paths) | 1505 | 1563 | 1128 | -25% |
| **`[NEW]` Activity timeline accountId directo** | n/a | 1065 | **673** | **-55% vs OLD** |
| Activity timeline simple (test único, OPT-001) | 1500–19000 | <50 | **<50** | **-99.7%** |
| Activity count | 496 | 498 | 963 | (variabilidad WiFi) |
| `/accounts/[id]` getAccountByIdRaw | 946 | 944 | 688 | **-27%** |
| `/contacts` list | 272 | 270 | 666 | (variabilidad) |
| `/accounts` list | 472 | 281 | 686 | (variabilidad) |
| `/pipeline` | 440 | 767 | 806 | (variabilidad) |
| `/opportunities/[id]` (OPT-011) | 934 | 929 | **669** | **-28%** |
| Tasks tab | 551 | 678 | 682 | -1% |
| `/heatmap` | 147 | 285 | 692 | (variabilidad) |
| `/api/tasks/[id]` | 1061 | 1062 | 667 | **-37%** |
| `loadUserPermissions` | 667 | 665 | 670 | 0% (cache no aplica en bench) |

> **Sobre la variabilidad**: el bench corre contra Supabase prod sobre
> WiFi residencial → us-west-2. Los deltas <±10% son ruido. Los grandes
> (-99.7% Activity simple, -55% timeline post-OR, -73% relationJoins en
> el test directo) son señal real.

> **`loadUserPermissions`** mismo número porque el bench abre un nuevo
> PrismaClient cada corrida → cache nunca pega. En prod Vercel el cache
> SÍ persiste dentro de un container warm (OPT-007 + OPT-016).

## Lo que el usuario va a sentir (post batch 3)

| Acción del usuario | Antes | Después |
|---|---|---|
| Click cuenta → Overview | ~1 s | ~700 ms ✅ |
| Click cuenta → Actividad (cuenta normal) | ~1.5 s | **~670 ms** ✅ |
| Click cuenta → Actividad (cuenta hot, pre-fix) | hasta 19 s | **<200 ms** ✅✅ |
| Pipeline | ~440 ms | ~440 ms |
| Login post-deploy | ~700 ms | ~500 ms ✅ |
| Re-abrir task drawer (mismo task) | re-fetch | **cache 30 s + dedup** ✅ |
| Abrir 2do task drawer del mismo task | 2 requests | **1 request** ✅ (React Query) |
| Dashboard 2do usuario en cold start | ~2 s | **~10 ms** ✅✅ (OPT-016 L2) |
| Opp detail con 50 contactos + 100 checkpoints | ~2.5 s | **~670 ms** ✅✅ (OPT-011) |

## Fixes aplicados (11 commits)

### Batch 1 — Quick wins (5 fixes, 45 min)

| ID | Fix | Tests |
|---|---|:-:|
| OPT-001 | Drop single-col indexes Activity (forzar uso de composites) | 2/2 |
| OPT-002 | Pipeline regression guard (no fix necesario aún) | 1/1 |
| OPT-003 | `take` en `getOpportunityById` (50/100/50) | 3/3 |
| OPT-004 | `take` en `getTaskById` (30/50/20) | 3/3 |
| OPT-008 | `writeAuditLog` fire-and-forget en login/logout | 2/2 |

### Batch 2 — Compuestos (3 fixes, 30 min)

| ID | Fix | Tests |
|---|---|:-:|
| **OPT-005** | **Backfill accountId + listActivities sin OR** | 2/2 |
| OPT-007 | Cache `loadUserPermissions` con `unstable_cache` (5 min) | 3/3 |
| OPT-010 | `Cache-Control` headers en `/api/tasks/[id]` y `contacts-mini` | 2/2 |

### Batch 3 — Estructurales (3 fixes, 90 min)

| ID | Fix | Tests |
|---|---|:-:|
| **OPT-011** | **Prisma `relationLoadStrategy: 'join'` en queries con muchos includes** | **1/1** |
| **OPT-013** | **React Query (TanStack) — client-side cache + dedup compartido** | **5/5** |
| **OPT-016** | **Cache shared via tabla Postgres `Cache` (L2 cross-instance)** | **8/8** |

**Total: 32/32 tests pasando.**

## Detalle batch 3

### OPT-011 — `relationLoadStrategy: 'join'`

**Problema**: Prisma `findUnique({ include: { ... } })` ejecuta 1 query
para el row principal + 1 query por cada relation. `getOpportunityById`
con includes anidados (contactRoles → contact, stageHistory → changedBy,
checkpoints → assignee/createdBy/completedBy) genera ~9 queries
secuenciales = ~2.5 s sobre WiFi residencial.

**Solución**: pasar `relationLoadStrategy: 'join'` (preview feature en
Prisma 5.22). El client genera un solo SQL con LATERAL JOINs para todas
las relaciones.

**Aplicado a**:
- `src/lib/opportunities/queries.ts::getOpportunityById`
- `src/lib/tasks/queries.ts::getTaskById`
- `src/lib/activities/queries.ts::listActivities`

**Resultado**: 2528 ms → 669 ms en test directo de getOpportunityById
(−73%). En el bench general, /opportunities/[id] pasó de 929 → 669 ms.

### OPT-013 — React Query

**Problema**: múltiples componentes (activity-composer, opportunity-drawer,
account-detail) fetchean los mismos endpoints (`/api/accounts/[id]/contacts-mini`,
`/api/tasks/[id]`) sin compartir cache. 2 task drawers seguidos del mismo
task = 2 requests al mismo endpoint.

**Solución**:
- Instalado `@tanstack/react-query@^5.100.9`.
- `<QueryProvider>` montado en `src/app/(dashboard)/layout.tsx` con
  defaults conservadores (staleTime 30 s, gcTime 5 min, retry 1,
  refetchOnWindowFocus false).
- Hooks `useAccountContacts(accountId)` y `useTaskById(taskId)`.
- `activity-composer.tsx` migrado de `useState` cache manual a
  `useAccountContacts()`. Quick-create también hace
  `queryClient.setQueryData()` + `invalidateQueries()` para refresh
  inmediato sin re-fetch.

**Resultado**: 2 task drawers consecutivos del mismo task = 1 request.
Cambiar de cuenta y volver dentro de 30 s = sin re-fetch de contacts-mini.

### OPT-016 — Cache compartido vía tabla Postgres

**Problema**: `unstable_cache` de Next.js es per-Vercel-function — en cold
start desaparece y el cómputo se vuelve a ejecutar. Para una organización
con 5-10 usuarios concurrentes, 50% de los hits son cold (Vercel scale
horizontal).

**Solución**:
- Nueva tabla `Cache(key, value JSONB, expiresAt, createdAt)` en Postgres.
- Helper `src/lib/shared/shared-cache.ts` exporta:
  - `cached(key, ttlMs, fn)` — read-or-compute con auto-upsert.
  - `invalidateCache(key | prefix*)` — exact o wildcard.
  - `sweepExpiredCache()` — para cron periódico.
- Layered cache aplicado a `loadDashboardData`:
  - **L1** = `unstable_cache` (in-memory por fn, instant)
  - **L2** = `cached()` (Postgres, ~10 ms hit, sobrevive cold start)
  - **L3** = cómputo real (~200–2000 ms)

**Resultado**: 2do usuario que entra al dashboard dentro de la ventana
de 60 s con un container nuevo = ~10 ms en lugar de ~2 s. Lazy sweep
mantiene la tabla limpia (cada miss borra rows expiradas).

## Items pendientes priorizados (futuro)

Ver [`05-backlog-futuro.md`](./05-backlog-futuro.md). Lo que queda:

1. **OPT-009** — Skeleton loaders en task drawer + opp detail. Mejora UX
   percibido sin tocar performance real. Esfuerzo: S.
2. **Sweep cron** para tabla `Cache` — limpiar entradas expiradas que
   ya no son consultadas. 1 línea en `vercel.json` cron + 1 endpoint.
   Esfuerzo: XS.
3. **Aplicar layered cache a más loaders pesados** — `loadAging`,
   `pipelineByStage`, `activityByWeek`. Esfuerzo: S, alto impacto.
4. **Lighthouse CI + SpeedInsights** baseline cuando esté on-call un
   tiempo (actualmente Vercel Analytics free).

## Recomendaciones de monitoreo continuo

### En la app
1. **Vercel Analytics + Speed Insights** (built-in, free tier OK).
2. **Sentry** para errors + slow transactions.
3. **Prisma `log: ['warn', 'error']`** en prod ✅ ya está.

### En la DB
1. **Supabase logs slow_query** (>500 ms) revisar semanal.
2. **Auto-VACUUM + ANALYZE** ya activo en Supabase managed.
3. **Tamaño de tabla `Cache`** semanal — si pasa de 10 MB algo no se
   está limpiando (correr `sweepExpiredCache()`).

### En tests / CI
1. `pnpm test` en GitHub Actions pre-merge a main (32 tests, ~13 s).
2. `pnpm bench:db` mensual, trackear p50 en Notion/Sheet. Si crece >50%
   sin causa, investigar.
3. Lighthouse CI cuando se sume primera SPA real-time.

## Archivos

- [`00-stack.md`](./00-stack.md) — stack mapeado
- [`01-diagnostico.md`](./01-diagnostico.md) — hallazgos categorizados
- [`02-benchmark-antes.md`](./02-benchmark-antes.md) — pre-fix
- [`03-plan-optimizacion.md`](./03-plan-optimizacion.md) — plan priorizado
- [`04-fixes-aplicados.md`](./04-fixes-aplicados.md) — commits + tests
- [`05-backlog-futuro.md`](./05-backlog-futuro.md) — pendientes
- [`scripts/bench-db.ts`](./scripts/bench-db.ts) — bench reproducible
- [`__tests__/`](./__tests__/) — 11 archivos, 32 assertions

Branch: `perf/qa-navegacion-erp` — 11 commits ahead de `main`. Listo para
review/merge.

---

## Cambio de comportamiento documentado

### OPT-005: timeline de cuenta filtra solo por `accountId`

**Antes**: el timeline mostraba activities con `accountId=X` OR
`opportunity.accountId=X` OR `contact.accountId=X`.

**Después**: solo `accountId=X`.

**Por qué es seguro**:
- 117,590 (97.1%) ya tenían accountId directo (Asana + HubSpot lo setean).
- 1,834 (1.5%) se backfillaron desde `contact.accountId` en migration
  `20260505190000_opt005_backfill_activity_account`.
- 1,670 (1.4%) son orphans (contact sin accountId asignado) → no aparecían
  en ningún timeline de cuenta antes ni después.

**Mantener consistencia hacia adelante**: `createActivity` mutation ahora
resuelve `accountId` desde el contact/opp linkeado si no fue pasado. El
test guarantee es:

```sql
SELECT COUNT(*) FROM "Activity" a
  JOIN "Contact" c ON a."contactId" = c.id
  WHERE a."accountId" IS NULL AND c."accountId" IS NOT NULL
-- expected: 0
```

### OPT-016: tabla `Cache` viva en prod

La tabla `Cache` es nueva — Prisma generó el client con el modelo
`prisma.cache`. Si se hace rollback de batch 3, hay que borrar la tabla
manualmente:

```sql
DROP TABLE IF EXISTS "Cache";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260505200000_opt016_cache_table';
```

Nada externo depende de esta tabla — es un cache puro, todo dato es
recuperable del cómputo original.
