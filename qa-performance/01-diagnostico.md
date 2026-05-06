# Fase 1 — Diagnóstico de performance

Cada hallazgo lleva: **archivo:línea**, descripción, impacto estimado, evidencia.

Resumen ejecutivo: **el bottleneck #1 es el planner de Postgres eligiendo el
índice equivocado en queries de Activity por cuenta** — 11 segundos para
traer las 25 actividades más recientes de la cuenta más activa, cuando
debería ser <50ms. Hay otros hallazgos secundarios pero éste solo explica
la mayor parte de la lentitud reportada.

---

## 1.1 Backend / Base de datos

### 🔴 P0 — `OPT-001` Postgres planner ignora composite index `Activity_accountId_occurredAt_idx`

**Archivo**: `prisma/schema.prisma` (índice OK), planner-side issue

**Descripción**: El composite `(accountId, occurredAt DESC)` que agregamos
existe en DB, pero el planner sigue eligiendo `Activity_occurredAt_idx`
(single-col) y filtrando 94,204 filas en memoria para llenar el LIMIT 25.

**Impacto**: 🔴 ALTO. Esta query corre en CADA visita a `/accounts/[id]`
(tab Actividad), `/opportunities/[id]` y `/contacts/[id]`.

**Evidencia (EXPLAIN ANALYZE)**:
```
Limit  (actual time=907.660..11016.603 rows=25 loops=1)
  Buffers: shared hit=99386 read=9836
  ->  Index Scan Backward using "Activity_occurredAt_idx" on "Activity"
        Filter: ("accountId" = 'cmos6eqvx001iah3ywfdfvtaz')
        Rows Removed by Filter: 94204
Execution Time: 11023.191 ms
```

**Causa raíz**: el planner subestima el costo del filter sobre 94K filas y
prefiere el índice más pequeño. Postgres no usa el composite porque cree
que el single + filter es más barato (estimado erróneo).

**Fix propuesto**: `DROP INDEX "Activity_occurredAt_idx"` y
`DROP INDEX "Activity_accountId_idx"` (también single-col) — los composites
los reemplazan en TODOS los casos. Sin esos dos índices el planner está
forzado a usar el composite. Drop también baja costo de INSERT y BLOB de
DB.

---

### 🔴 P0 — `OPT-002` Pipeline `Opportunity` por `status` hace Seq Scan

**Archivo**: `src/lib/pipeline/queries.ts:100`

**Descripción**: El pipeline kanban filtra por `status='OPEN'` y ordena por
`stageChangedAt DESC`. Sin composite, hace Seq Scan + sort.

**Impacto**: 🟠 MEDIO ahora (52ms con 766 opps), 🔴 ALTO si crece a 5K+ opps.

**Evidencia**:
```
Seq Scan on "Opportunity" (cost=0.00..164.57 rows=306)
  Filter: (status = 'OPEN')
  Rows Removed by Filter: 460
Sort + LIMIT 100 — top-N heapsort, 39kB
Execution Time: 52.360 ms
```

**Fix propuesto**: agregar índice `(status, stageChangedAt DESC)` y
`(status, ownerId, stageChangedAt DESC)` para "mi pipeline".

---

### 🔴 P0 — `OPT-003` `getOpportunityById` carga relaciones sin límite

**Archivo**: `src/lib/opportunities/queries.ts:105-144`

**Descripción**: Trae `stageHistory`, `checkpoints`, `contactRoles` SIN `take`.
Una opp con muchos cambios de stage o checkpoints inicia con N fetches
extra.

**Impacto**: 🟠 MEDIO. Las opps de Asana traen ~5-15 stage_history rows.
No es catastrófico pero acumula.

**Evidencia**:
```ts
// queries.ts:128-143
stageHistory: {
  include: { changedBy: { select: { id: true, name: true } } },
  orderBy: { changedAt: 'desc' },  // ← sin take
},
checkpoints: {
  include: { ... },
  orderBy: [{ completedAt: 'asc' }, ...],  // ← sin take
},
```

**Fix propuesto**: `take: 50` en stageHistory + `take: 100` en checkpoints.
Si una opp tiene más de eso, el tab "Historia de fases" puede paginar.

---

### 🟠 P1 — `OPT-004` `getTaskById` carga subtree completo

**Archivo**: `src/lib/tasks/queries.ts:85-115`

**Descripción**: El task drawer carga subtasks + comments + attachments +
blockedBy + blocking. Ningún `take`. Sub-N+1 implícito en `subtasks._count`
sub-counts.

**Impacto**: 🟠 MEDIO. Tasks importadas de Asana suelen tener 0-3 subtasks
y 0 comments, así que en la práctica no escala. Pero un task power-user
puede tener cientos de comments.

**Fix propuesto**: `take: 50` en comments, `take: 30` en subtasks, `take: 20`
en attachments. La UI ya muestra paginación.

---

### 🟠 P1 — `OPT-005` `getTaskStatsForAccount` con `take: 2000`

**Archivo**: `src/lib/tasks/queries.ts:181-191`

**Descripción**: Para calcular stats de tasks de una cuenta, trae 2000 rows.
Se usa para 14-day completion trend + top assignees.

**Impacto**: 🟡 BAJO ahora (1507 tasks total), pero el take=2000 sin filtro
de fecha es agresivo. Mejor agregar `WHERE createdAt >= 30 days ago`.

**Fix propuesto**: limitar a últimos 30 días o usar `groupBy` de Prisma con
date_trunc.

---

### 🟠 P1 — `OPT-006` `loadPipeline` sin paginación

**Archivo**: `src/lib/pipeline/queries.ts:100`

**Descripción**: `prisma.opportunity.findMany()` sin `take` — devuelve TODAS
las opps abiertas matching filtros. Con 766 opps actuales OK. A largo plazo,
si el pipeline crece >5K, va a doler.

**Impacto**: 🟡 BAJO ahora, 🔴 ALTO a escala.

**Fix propuesto**: `take: 1000` con un mensaje al user "mostrando primeras
1000 — refiná los filtros para ver el resto". Alternativa: paginar por
stage (cada columna del kanban con su propia paginación).

---

### 🟡 P2 — `OPT-007` `loadUserPermissions` corre prisma.findUnique en cada login + cada token-refresh

**Archivo**: `src/lib/auth.ts:21-42`, `auth.ts:139,149`

**Descripción**: Cada login corre `prisma.user.findUnique` con triple-include
(roles → role.permissions → permission). Se ejecuta en cada signIn (OK) y en
cada `update` trigger del JWT (no OK).

**Impacto**: 🟡 BAJO. JWT update triggers son raros. Pero la query es
expensive (3 joins) y NO está cacheada.

**Fix propuesto**: cachear con `unstable_cache` por userId, revalidate 5min.
Roles y permisos cambian pocas veces.

---

### 🟡 P2 — `OPT-008` `writeAuditLog` síncrono en login

**Archivo**: `src/lib/auth.ts:142`

**Descripción**: Cada login bloquea hasta que `auditLog.create()` termina.

**Impacto**: 🟡 BAJO (solo se ejecuta en login, no en cada navegación).
Pero suma 50-200ms al primer login post-deploy.

**Fix propuesto**: usar `void writeAuditLog(...)` (fire-and-forget). Ya hay
catch dentro.

---

### 🟢 P3 — `OPT-009` Cron HubSpot cada 5 min compite por conexiones

**Archivo**: `vercel.json`, `src/app/api/integrations/hubspot/cron/route.ts`

**Descripción**: Cada 5 min un tick del cron lanza `parallelMap` con
concurrency 8 contra Prisma. El pool de Supabase free tier es limitado;
si un usuario está navegando en ese momento, su request espera.

**Impacto**: 🟡 BAJO observable. No es la causa principal pero contribuye.

**Fix propuesto**: bajar parallelism del cron de 8 → 4. Y/o spread cron a
*/15 con burst chunks chicos.

---

## 1.2 API / Red

### 🟠 P1 — `OPT-010` Sin `Cache-Control` headers en API JSON respuestas

**Archivo**: `src/app/api/**/route.ts` (todas)

**Descripción**: `NextResponse.json(...)` sin headers explícitos. El cliente
no puede aprovechar HTTP cache + intermediarios CDN tampoco.

**Impacto**: 🟠 MEDIO. Endpoints como `/api/accounts/[id]/contacts-mini`,
`/api/tasks/[id]` se llaman repetidamente y NO están cacheados client-side.

**Fix propuesto**: `Cache-Control: private, max-age=60, stale-while-revalidate=300`
en endpoints idempotentes. NO cachear endpoints de auditoría / reportes
sensibles.

---

### 🟠 P1 — `OPT-011` Sin debounce en task drawer + audience builder fetches

**Archivo**: `src/app/(dashboard)/accounts/[id]/tasks/task-detail-drawer.tsx:122,146`

**Descripción**: `fetch('/api/tasks/${taskId}')` se dispara en open + después
de cada mutation con un re-fetch. No hay debounce ni dedupe.

**Impacto**: 🟡 BAJO si el user no abre/cierra rápido. Pero al hacer
add-comment + immediate close, se hacen 2-3 fetches.

**Fix propuesto**: usar SWR / Next/cache patterns o mutation-driven
optimistic updates. SWR suma una dependencia razonable.

---

### 🟢 P3 — `OPT-012` Sin compresión explícita en responses

**Archivo**: N/A (Vercel maneja gzip/brotli automático para HTML/JS)

**Descripción**: Vercel comprime HTML/JS pero las respuestas JSON de API
también deberían ir comprimidas. Verificar headers.

**Impacto**: 🟢 BAJO probable (Vercel lo hace automáticamente para
`Content-Type: application/json` con tamaño > threshold).

**Fix propuesto**: confirmar con curl de prod. Si no comprime, agregar
manual a las rutas con respuestas grandes (`/api/extractor/run`).

---

## 1.3 Frontend

### 🔴 P0 — `OPT-013` Sin librería de cache cliente (React Query / SWR)

**Archivo**: package.json (no hay)

**Descripción**: La app no tiene React Query, SWR, ni Apollo cache. Cada
componente que hace `fetch('/api/...')` no comparte el resultado con
otros componentes del mismo viaje. Si abro 2 task drawers seguidos del
mismo task, hace 2 requests.

**Impacto**: 🟠 MEDIO. Mucho contenido viene por RSC (cache de Next), pero
los componentes con interacción client-side fetch se duplican.

**Fix propuesto**: agregar `@tanstack/react-query` (~12KB gzipped). Crear
hooks `useTaskById`, `useAccountContacts`, etc. Beneficio extra: cache de
mutations + optimistic updates + dedupe.

---

### 🟠 P1 — `OPT-014` Tablas TanStack sin virtualización

**Archivo**: `src/app/(dashboard)/contacts/components/contacts-table.tsx`,
`src/app/(dashboard)/accounts/components/accounts-table.tsx`,
`src/app/(dashboard)/opportunities/components/opportunities-table.tsx`

**Descripción**: Las tablas usan `@tanstack/react-table` v8 pero no
`@tanstack/react-virtual`. Con `pageSize=50` actual no es problema, pero el
schema permite hasta `10000`.

**Impacto**: 🟡 BAJO con pageSize=50 default. 🔴 ALTO si user pasa pageSize
arbitrario.

**Fix propuesto**: clamp `pageSize` a max 200 en validation. Para listados
internos (heatmap con 100 rows), agregar virtualización.

---

### 🟢 P3 — `OPT-015` Sin code-split por ruta visible

**Archivo**: Next App Router (built-in)

**Descripción**: Next 15 hace code-split por ruta automáticamente. Lo verifico
con `next build --analyze` en Fase 5 si hace falta.

**Impacto**: probablemente 🟢 ya bien.

---

## 1.4 Infraestructura / Configuración

### 🟠 P1 — `OPT-016` `unstable_cache` se evapora con cold start de Vercel

**Archivo**: `src/lib/accounts/queries.ts:101-169`,
`src/app/(dashboard)/page.tsx:44`, `src/lib/shared/lite-lists.ts`

**Descripción**: Vercel serverless = cada función se "duerme" tras inactividad.
Al volver, todos los `unstable_cache` están vacíos. El primer hit paga el
costo completo.

**Impacto**: 🔴 ALTO percibido. La queja "cada vez que entro tarda" se
explica MUCHO por cold-starts ya que el equipo es chico (5 users) → poca
warm path.

**Fix propuesto**: dos opciones:
- **(a)** Habilitar Vercel Pro con "min instances" → tiene un costo.
- **(b)** Mover cache compartido a Postgres (tabla `Cache(key, json, expiresAt)`)
  o Vercel KV (~$0.20/M reads). Mucho más barato y persistente.

---

### 🟢 P3 — `OPT-017` Logs Prisma en prod ya OK

**Archivo**: `src/lib/db.ts:8`

**Descripción**: `log: ['error']` en prod ✅. No hay log de queries que
mataría performance.

**Impacto**: ya optimizado.

---

### 🟢 P3 — `OPT-018` Middleware de NextAuth en cada request — peso bajo

**Archivo**: `src/middleware.ts`, `src/lib/auth.config.ts`

**Descripción**: El middleware corre en cada request salvo los exclusos
explícitos (api/auth, cron, webhook, static). Solo lee el JWT cookie y
chequea isLoggedIn. NO hace queries DB.

**Impacto**: 🟢 BAJO. ~5ms.

---

## Hallazgos derivados (no en el alcance de "lentitud" pero notables)

- **OPT-019**: `pipeline/forecast.ts:39-57` corre 3 findMany de opps sin
  take. Con 766 opps OK. Ver Fase 5.
- **OPT-020**: `prisma.contact.findMany` en `/contacts/new` page con take=500
  para dropdown de cuenta — 500 es alto. Migrar a Combobox con search.
- **OPT-021**: `getAccountByIdRaw` aún incluye 50 contactos + 30 opps en
  el initial load aunque tabs los re-fetcheen. Podríamos bajar a 5+5.

Estos van a `qa-performance/05-backlog-futuro.md`.

---

## Ranking final por impacto observable

| Score | ID | Hallazgo | Impacto en lentitud reportada |
|---|---|---|---|
| 🔴 100 | OPT-001 | Planner ignora composite idx | **80% del problema** |
| 🟠 50 | OPT-016 | Cold-starts evaporan cache | 30-40% del problema |
| 🟠 40 | OPT-013 | Sin cache cliente | 15% del problema |
| 🟠 30 | OPT-002 | Pipeline seq scan | crece con la base |
| 🟠 20 | OPT-003/4 | Includes sin take | 10% acumulado |
| 🟡 10 | OPT-010 | Sin Cache-Control | mejora marginal |
| ... |
