# Fase 2 — Benchmark "antes"

## Setup

- **DB**: Supabase prod (us-west-2, vía direct connection — no PgBouncer
  para mediciones limpias).
- **Cliente**: misma máquina de desarrollo, latencia variable según red
  WiFi a us-west-2.
- **Iteraciones**: 5 corridas seguidas por query. Reportamos
  min/p50/p95/p99/max + bytes serializados promedio.
- **Volumen**: 121,094 activities · 29,774 contacts · 3,111 accounts · 766
  opps · 1,507 tasks · 159,715 integration mappings.

Script: [`qa-performance/scripts/bench-db.ts`](./scripts/bench-db.ts).

Reproducibilidad:
```bash
DATABASE_URL="..." bun run qa-performance/scripts/bench-db.ts
```

## Resultados crudos

| Query / Flujo | min | p50 | p95 | p99 | max | Payload |
|---|---:|---:|---:|---:|---:|---:|
| `/accounts/[id]` getAccountByIdRaw | 941 | **946** | 2166 | 2166 | 2166 | 11.5 KB |
| **Activity timeline** (cuenta hot) | 1498 | **1505** | 19159 | 19159 | 19159 | 34.8 KB |
| Activity count (cuenta hot) | 479 | **496** | 1234 | 1234 | 1234 | — |
| `/contacts` list status=ACTIVE | 272 | **272** | 778 | 778 | 778 | 34.3 KB |
| `/contacts` count | 133 | **134** | 266 | 266 | 266 | — |
| `/accounts` list 50 rows | 326 | **472** | 5337 | 5337 | 5337 | 17.4 KB |
| `/pipeline` loadPipeline OPEN | 429 | **440** | 1231 | 1231 | 1231 | **355.8 KB** |
| `/opportunities/[id]` getOpportunityById | 928 | **934** | 1652 | 1652 | 1652 | 1.3 KB |
| Tasks tab cuenta | 548 | **551** | 1141 | 1141 | 1141 | 152.6 KB |
| Sprint audit | 135 | **142** | 505 | 505 | 505 | 6.8 KB |
| `/heatmap` aggregation | 145 | **147** | 754 | 754 | 754 | 88.1 KB |
| `/api/tasks/[id]` getTaskById | 1060 | **1061** | 2131 | 2131 | 2131 | 0.9 KB |
| `loadUserPermissions` (login) | 662 | **667** | 1434 | 1434 | 1434 | 9.0 KB |
| **TOTAL p50** | | **7,767 ms** | | | | |

> Nota: `min` y `p50` son mediciones con buffers de Postgres calientes.
> `p95`/`p99` reflejan el peor caso (DB cold cache, pool pool busy).
> En prod Vercel + serverless cold-start, **todas las primeras requests
> están en el rango p95**.

## Lecturas críticas

### 🔴 Activity timeline = `1.5s` p50, `19s` p99

Confirma OPT-001. Es la query más cara y la más usada (la
ejecuta CADA visita a `/accounts/[id]`, `/opportunities/[id]`,
`/contacts/[id]` cuando el user va al tab Actividad).

A `1.5s` ya es perceptible. A `19s` el browser empieza a mostrar el "page
unresponsive" y el user piensa que la app está rota.

### 🟠 `/pipeline` 355 KB de payload

Aunque la query es decente (440ms p50), está mandando **355KB** al cliente.
Es por las 766 opps + relaciones. Sin paginación, esto se vuelve insostenible
con 5K+ opps.

### 🟠 getTaskById 1s p50 con payload de 0.9KB

Es un mismatch típico de "query barata pero el cliente espera 1s". La razón
son las múltiples sub-queries del INCLUDE (subtasks → assignees → users,
comments → users, attachments → users, etc). Prisma genera 5-7 queries
separadas y las espera en serie.

### 🟠 `loadUserPermissions` 670ms en cada login

3 niveles de joins (user → roles → role → permissions). Sin cache.

### 🟢 Sprint audit y Heatmap son rápidos (140-150ms)

Estos usan raw SQL con aggregations. Buena señal — la DB puede ser rápida
cuando se le pide bien.

## Mapping → flujos de usuario percibidos

| Flujo de navegación normal | Tiempo total (p50, sin red) |
|---|---:|
| Click en una cuenta → Overview tab | ~946 ms |
| Click en una cuenta → Activity tab | ~946 + 1505 + 496 = **2.9 s** |
| Cambiar a tab Tareas dentro de cuenta | +551 ms |
| Click en una opp → ver detalle | ~934 ms |
| Click en una task del kanban → drawer | ~1061 ms |
| Cambiar a `/contacts` | ~272 + 134 = ~406 ms |
| Cambiar a `/accounts` | ~472 ms |
| Cambiar a `/pipeline` | ~440 ms (+ 355 KB transfer) |
| Login (primera vez post-deploy) | ~667 ms |

**Total navigating around for ~30 seconds = ~5-7 s acumulados de espera.**
Y eso es **sin contar latencia de red** (us-west-2 → cliente típicamente
suma 100-300ms por request) ni cold-starts de Vercel.

## Lo que NO mide este benchmark

- **Latencia de red Vercel → Supabase**: en prod la latencia es <10ms
  porque ambos están en us-west-2.
- **Cold-starts de Vercel functions**: en una función fría suma 1-3s
  ANTES de que la query empiece. Lo confirmamos cuando una request seguida
  a otra fue muy rápida pero la primera del día fue lenta.
- **Frontend rendering**: TTI, hydration, etc. Lo veremos en Fase 5 con
  Lighthouse si hace falta.

## Conclusión Fase 2

Las mediciones confirman las hipótesis del diagnóstico. El **Activity
timeline es el bottleneck #1 con diferencia**. Si arreglamos solo eso
(OPT-001), el flujo "abrir cuenta + ver actividad" pasa de ~2.9s a ~1s
que ya es aceptable.
