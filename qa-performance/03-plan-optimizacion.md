# Fase 3 — Plan de optimización priorizado

## Metodología de score

```
score = impacto × (1 / esfuerzo) × (1 / riesgo)
```

- **Impacto**: 1 (bajo) → 10 (alto). Basado en p50 ganada × frecuencia
  del flujo.
- **Esfuerzo**: 1 (XS, <1h) → 5 (L, día completo).
- **Riesgo**: 1 (cambio aislado, fácil revertir) → 5 (refactor con
  superficie grande).

## Tabla priorizada

| # | ID | Esfuerzo | Impacto | Riesgo | **Score** | Quick win |
|---|---|---:|---:|---:|---:|---|
| 1 | **OPT-001** | XS (1) | 10 | 1 | **100** | ✅ |
| 2 | **OPT-002** | XS (1) | 6 | 1 | **60** | ✅ |
| 3 | **OPT-003** | XS (1) | 5 | 1 | **50** | ✅ |
| 4 | **OPT-016** | M (3) | 8 | 2 | **13** | — |
| 5 | **OPT-013** | M (3) | 6 | 2 | **10** | — |
| 6 | **OPT-007** | S (2) | 4 | 1 | **8** | ✅ |
| 7 | **OPT-010** | S (2) | 4 | 2 | **4** | — |
| 8 | **OPT-004** | XS (1) | 3 | 1 | **3** | ✅ |
| 9 | **OPT-008** | XS (1) | 2 | 1 | **2** | ✅ |
| 10 | **OPT-009** | S (2) | 2 | 2 | **0.5** | — |

---

## Detalle por item (orden de implementación)

### OPT-001 — Drop single-col indexes que el planner prefiere mal

**Problema**: el planner elige `Activity_occurredAt_idx` (single col) en
queries de timeline por cuenta, ignorando el composite. Resultado: 11s
para devolver 25 filas.

**Solución**:
```sql
DROP INDEX "Activity_occurredAt_idx";
DROP INDEX "Activity_accountId_idx";
DROP INDEX "Activity_contactId_idx";
DROP INDEX "Activity_opportunityId_idx";
ANALYZE "Activity";
```

Los composites `Activity_{accountId,contactId,opportunityId}_occurredAt_idx`
y `Activity_createdById_occurredAt_idx` cubren todos los casos hot.

Beneficios secundarios:
- Cada INSERT es más barato (4 índices menos a mantener).
- DB size baja ~20-30MB.

**Esfuerzo**: XS (un script SQL targeted).
**Impacto**: 10/10 — hace que el flujo más usado pase de 1.5-19s a <50ms.
**Riesgo**: 1/5 — si algún query inesperado los necesita, el composite
sirve igual (con un step extra de filter sobre WHERE con accountId IS NULL,
caso rarísimo).

**Test requerido**: EXPLAIN ANALYZE post-fix mostrando que el composite
está siendo elegido + medición de tiempo de la query.

---

### OPT-002 — Composite `(status, stageChangedAt DESC)` en Opportunity

**Problema**: `loadPipeline` hace Seq Scan + sort de 766 opps abiertas.

**Solución**:
```sql
CREATE INDEX "Opportunity_status_stageChangedAt_idx"
  ON "Opportunity" ("status", "stageChangedAt" DESC);

-- Y para "mi pipeline":
CREATE INDEX "Opportunity_ownerId_status_stageChangedAt_idx"
  ON "Opportunity" ("ownerId", "status", "stageChangedAt" DESC)
  WHERE "ownerId" IS NOT NULL;
```

**Esfuerzo**: XS.
**Impacto**: 6/10 — pasa de Seq Scan a Index Scan. Crítico cuando opps
crezcan a 5K+.
**Riesgo**: 1/5.

**Test**: EXPLAIN del query de pipeline post-fix usa Index Scan, no Seq.

---

### OPT-003 — `take` en stageHistory + checkpoints + contactRoles

**Problema**: `getOpportunityById` no limita arrays nested.

**Solución**: agregar `take: 50` (stageHistory), `take: 100` (checkpoints),
`take: 50` (contactRoles).

**Esfuerzo**: XS (1 archivo, 3 líneas).
**Impacto**: 5/10 — para opps con poco historial, mejora marginal. Para
opps con 50+ stage changes, alto.
**Riesgo**: 1/5 — si una opp tiene >50 stage changes, el tab "historia"
puede paginar.

**Test**: snapshot test de payload size.

---

### OPT-004 — `take` en `getTaskById`

**Problema**: subtasks/comments/attachments sin limit.

**Solución**: `take: 30` subtasks, `take: 50` comments, `take: 20`
attachments.

**Esfuerzo**: XS.
**Impacto**: 3/10 — actualmente 0-3 subtasks por task en producción.
Beneficio futuro.
**Riesgo**: 1/5.

---

### OPT-007 — Cache de `loadUserPermissions`

**Problema**: 3-level join sin cache, corre en cada login + JWT update.

**Solución**: wrap con `unstable_cache` por userId, revalidate 5 min.
Invalidate tag `permissions` al actualizar roles.

**Esfuerzo**: S (2 archivos).
**Impacto**: 4/10 — login es raro pero notable.
**Riesgo**: 1/5 — fácil revertir.

**Test**: medir login + JWT update dos veces seguidas, segunda debe ser
hit (cache + ms).

---

### OPT-008 — `writeAuditLog` async (fire-and-forget)

**Problema**: bloquea login.

**Solución**: `void writeAuditLog(...)` con `.catch(() => {})`.

**Esfuerzo**: XS.
**Impacto**: 2/10.
**Riesgo**: 1/5.

---

### OPT-010 — `Cache-Control` headers en endpoints idempotentes

**Problema**: API responses sin cache headers.

**Solución**: agregar `Cache-Control: private, max-age=60,
stale-while-revalidate=300` a `/api/accounts/[id]/contacts-mini`,
`/api/tasks/[id]`, `/api/integrations/hubspot/status`. **NO** cachear
endpoints de auditoría / reportes / mutations.

**Esfuerzo**: S.
**Impacto**: 4/10 — ayuda al browser a no re-fetchear lo mismo en
navegación back/forward.
**Riesgo**: 2/5 — si falta invalidar después de mutation, user ve
data stale 60s.

---

### OPT-013 — Agregar React Query (TanStack Query)

**Problema**: client-side fetches no comparten cache, dedupe ni invalidación.

**Solución**: instalar `@tanstack/react-query` + `QueryClientProvider` en
layout. Migrar progresivamente los `fetch(...)` con `useQuery` para
endpoints idempotentes (tasks/[id], accounts/[id]/contacts-mini).

**Esfuerzo**: M (3-4 archivos clave + integración).
**Impacto**: 6/10 — beneficio compuesto en navegación normal.
**Riesgo**: 2/5 — agrega 12KB gzipped al bundle. No regresiones obvias.

**Test**: medir requests duplicados al navegar 2 veces a la misma cuenta:
debe pasar de 2 → 1.

---

### OPT-016 — Cache shared persistente (Vercel KV o tabla `Cache`)

**Problema**: `unstable_cache` se evapora en cold start.

**Solución (recomendada)**: Vercel KV (~$0.20/M reads). Crear helper
`shared-cache.ts` que envuelva `unstable_cache` + KV fallback.

**Solución alternativa**: tabla `Cache(key, valueJson, expiresAt)` en
Postgres + helper que upsert / read antes de fallback.

**Esfuerzo**: M (3-4 archivos + setup KV).
**Impacto**: 8/10 — elimina el efecto cold-start.
**Riesgo**: 2/5 — depende de service externo, agrega latencia mínima
al lookup.

**Test**: simular cold start y medir hit rate del shared cache.

---

## Quick wins (Fase 4 batch 1)

Voy a aplicar primero los **5 XS-quick-wins** que tienen score >= 3 y
riesgo 1/5:

1. **OPT-001** — Drop single-col indexes (10 min + ANALYZE)
2. **OPT-002** — Composite index pipeline (5 min)
3. **OPT-003** — take en getOpportunityById (5 min)
4. **OPT-004** — take en getTaskById (5 min)
5. **OPT-008** — writeAuditLog async (2 min)

Esto debería darnos el ~80% de la mejora total medida.

## Batch 2 (Fase 4 después de validar batch 1)

6. **OPT-007** — Cache loadUserPermissions
7. **OPT-010** — Cache-Control headers
8. **OPT-013** — React Query
9. **OPT-016** — Vercel KV

## Items que NO voy a tocar (out of scope)

- **OPT-009** (cron parallelism): cambio de comportamiento de sync.
- **OPT-012** (compresión): probablemente Vercel ya lo hace.
- **OPT-014** (virtualización): no es bottleneck observable hoy.
- **OPT-017/018** (logs/middleware): ya están bien.

---

## Plan de tests

Voy a agregar **vitest** (lightweight, compatible Next 15) + un par de
test files:

- `qa-performance/scripts/bench-db.ts` (ya existe — el de Fase 2).
- Nuevo: `qa-performance/scripts/explain-check.ts` que verifica que
  ciertos queries usan el índice esperado (assertions sobre EXPLAIN).
- Nuevo: `qa-performance/__tests__/hot-queries.test.ts` con vitest +
  expectations sobre tiempo máximo per query (relajado, p99 < N ms).

No voy a tocar los tests existentes (no hay) ni a agregar Playwright /
e2e por ahora — sale del alcance.

---

## Pregunta antes de avanzar

¿Te parece bien que arranque Fase 4 con el batch 1 (5 quick wins)?
Eso me toma ~30 min y te doy el reporte de Fase 5 con benchmarks
"después" para ver el delta concreto.

Si decís sí, avanzo. Si querés que toque otros items primero o que
ignore alguno, decime cuál.
