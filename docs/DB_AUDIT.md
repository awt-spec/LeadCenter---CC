# Audit de la base de datos — Lead Center

Análisis técnico real de la BD en producción (`szmlzizfulgtlezqpzlc.supabase.co`, región `us-west-2`).

---

## 📊 Estado actual

| Métrica | Valor |
|---|---|
| **Tablas en `public`** | 30 |
| **Filas totales** | 375 |
| **Tamaño total DB** | 2 MB |
| **Foreign Keys** | 57 |
| **Índices totales** | ~95 |
| **Connection pool** | 60 max (Supabase Supavisor, transaction mode :6543) |
| **Conexiones en uso** | ~7 (idle) |

### Tablas más grandes (por bytes, no rows)

| Tabla | Filas | Total | Datos | Índices |
|---|---:|---:|---:|---:|
| `Contact` | 5 | 240 kB | 16 kB | **224 kB** ← muy indexada |
| `Opportunity` | 22 | 208 kB | 48 kB | 160 kB |
| `Activity` | 33 | 176 kB | 48 kB | 128 kB |
| `Account` | 10 | 144 kB | 16 kB | 128 kB |
| `Campaign` | 5 | 112 kB | 16 kB | 96 kB |

> Nota: el tamaño está dominado por overhead de páginas vacías + índices. Con miles de filas, la proporción se invierte.

---

## ✅ Fortalezas

### 1. Schema bien estructurado (30 modelos)
- 6 entidades principales: Contact, Account, Opportunity, Activity, Campaign, Task
- 24 entidades de soporte: roles/permisos, tags, mentions, attachments, custom fields, etc.
- Convenciones consistentes: cuid IDs, createdAt/updatedAt, soft references por FK opcional.

### 2. Indexado agresivo en `Contact` (la tabla crítica)
14 índices, incluyendo:
- Single-column: `email`, `fullName`, `companyName`, `status`, `source`, `country`, `ownerId`, `marketSegment`, `accountId`, `createdAt`
- Compuestos: `(status, ownerId)`, `(accountId, status)`
- Único: `email`

Esto cubre los filtros típicos de un listado con 100k+ registros sin necesidad de seq-scan.

### 3. Integridad referencial
57 foreign keys con políticas explícitas:
- `onDelete: Cascade` para tablas dependientes (mentions, attachments, role_permissions).
- `onDelete: SetNull` para references opcionales (owner, parent account).
- `onDelete: Restrict` implícito en relaciones críticas.

### 4. Validación en boundary
Cada server action valida con Zod **antes** de tocar Prisma. Imposible inyectar valores fuera de schema.

### 5. RBAC + AuditLog
- 36 permisos × 6 roles, asignables vía UI.
- Cada mutation escribe en `AuditLog` con userId / action / changes (JSON diff).
- 6 entradas hoy, escala lineal con uso.

### 6. Connection pooling correcto
- DATABASE_URL apunta a Supavisor `:6543` con `?pgbouncer=true` (transaction mode).
- DIRECT_URL apunta a `:5432` (solo para migrations).
- Esto es la config recomendada de Supabase para serverless / Vercel functions.

### 7. Polimorfismo limpio en custom fields
`CustomFieldValue` con 3 FKs opcionales (contactId, accountId, opportunityId) + 3 unique compuestos. Permite extender cualquier entidad sin tocar el schema.

---

## ⚠️ Debilidades / Riesgos

### 🔴 1. Sin migrations versionadas
- Carpeta `prisma/migrations/` **no existe**.
- Cada cambio se aplica con `prisma db push --accept-data-loss`. Sin historial, sin rollback.
- **Impacto**: si un push rompe prod, el único camino es restaurar el backup completo.
- **Fix**: `pnpm prisma migrate dev --name init` para baseline + `migrate deploy` en CI.

### 🔴 2. Sin RLS (Row-Level Security)
- 0 tablas con `relrowsecurity = true`.
- Toda autorización vive en la app (Prisma + RBAC en server actions).
- **Impacto**: si alguien obtiene el password de DB → ve todo. No hay defensa en profundidad.
- **Fix recomendado**: activar RLS en Contact, Account, Opportunity, Activity, Task, Campaign con políticas que filtren por `auth.uid()` (requiere migrar auth a Supabase Auth o usar JWT custom claims).

### 🟠 3. Sin full-text search
- 0 índices GIN.
- Búsquedas (`q` en `/contacts`, `/accounts`, `/opportunities`) usan `ILIKE %q%` → seq-scan o index-scan parcial.
- **Impacto a 100k+ contactos**: búsqueda > 500ms.
- **Fix**:
  ```sql
  ALTER TABLE "Contact" ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('spanish',
        coalesce("fullName", '') || ' ' ||
        coalesce("email", '') || ' ' ||
        coalesce("companyName", '') || ' ' ||
        coalesce("jobTitle", '')
      )
    ) STORED;
  CREATE INDEX contact_search_idx ON "Contact" USING GIN (search_vector);
  ```
  Luego en queries: `WHERE search_vector @@ plainto_tsquery('spanish', $1)`.

### 🟠 4. Pagination con `OFFSET`
- Todos los listados (`listContacts`, `listAccounts`, etc.) usan `skip: (page-1)*pageSize`.
- **Impacto a 100k**: ir a página 100 (offset 5000) hace que Postgres lea las primeras 5050 rows y descarte 5000.
- **Fix**: cursor-based pagination con `WHERE createdAt < $cursor ORDER BY createdAt DESC LIMIT N`.

### 🟠 5. Sin backups verificados
- Supabase tiene auto-backup diario en plan Pro, pero:
  - Nunca testé un restore.
  - No hay snapshots manuales antes de pushes destructivos.
- **Fix**:
  ```bash
  # Backup manual con pg_dump
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```
  Programar como cron en Vercel cron jobs o GitHub Actions.

### 🟠 6. Sin caché
- Cada page refresh dispara N queries Prisma a Supabase.
- Latencia us-west-2 → Vercel iad1: ~80-120ms RTT por query.
- **Impacto**: home dashboard hace 6 queries en Promise.all → 200-300ms en cold path.
- **Fix corto plazo**: `unstable_cache` de Next 15 con revalidate 60s para listados.
- **Fix medio plazo**: Redis (Upstash) o Vercel KV para queries calientes.

### 🟡 7. Demo bypass aún activo
- El email `demo@sysde.com` + password literal en código entran sin tocar DB.
- OK para demo público, pero queda como surface de ataque si la app se vuelve interna.
- **Fix**: env var `DEMO_MODE=true` que controle el bypass; off en producción real.

### 🟡 8. Sin alertas de queries lentas
- No hay Sentry / DataDog / Vercel Analytics conectado a la DB.
- Una query de 5s pasa silenciosa hasta que un user se queja.
- **Fix**: activar Vercel Speed Insights + Supabase Pro stats; opcionalmente Sentry.

### 🟡 9. JSON sin índice
- `Activity.bodyJson`, `AuditLog.changes`, `CustomFieldValue.value` son JSON sin GIN index.
- Hoy no se filtra sobre ellos, pero si en el futuro el user pide "buscar actividades cuyo body mencione X", fallback a seq-scan.
- **Fix preventivo**: GIN index si se va a buscar adentro del JSON.

### 🟡 10. Contact unique solo en email
- Si el user importa el mismo contacto desde 2 fuentes con emails distintos → duplicado lógico no detectable por unique.
- **Fix**: agregar fuzzy-match deduplication en el ImportBatch (ya hay `dedupeStrategy` en schema, falta wire-up).

---

## 🎯 Capacidad — qué aguanta hoy y qué no

| Tamaño | Listados | Búsqueda | Filtros indexados | Notas |
|---:|:---:|:---:|:---:|---|
| **375 (hoy)** | <100ms | <50ms | <10ms | Sobra capacidad |
| **10k** | ~150ms | ~80ms | <20ms | Todo OK con índices actuales |
| **100k** | ~250ms (offset bajo) / 2s (offset alto) | **800ms** | <50ms | Búsqueda lenta, offset pagination lento |
| **1M** | 3-5s con offset alto | 5-10s sin GIN | ~100ms | Necesita FTS + cursor pagination + caché |
| **10M** | requiere sharding | requiere FTS dedicado | requiere partitioning | Fuera de scope de SaaS B2B típico |

**Punto de quiebre realista**: ~50k-100k contactos. A partir de ahí los items 🟠 se vuelven 🔴.

---

## 📋 Plan de robustecimiento — orden recomendado

### Inmediato (esta semana, ~4h)
1. **Migrations baseline**: `prisma migrate dev --name init` con la DB actual como punto de partida → todo cambio futuro va versionado.
2. **`unstable_cache`** en queries de stats del home + reports → 200-300ms → 20ms.
3. **Backup manual** semanal con `pg_dump` a un bucket S3/R2.

### Corto plazo (próxima semana, ~1-2 días)
4. **Full-text search** GIN en Contact + Account (búsqueda ~10× más rápida a escala).
5. **Cursor pagination** en listados grandes.
6. **`DEMO_MODE` env-controlled** (preparar para apagarlo en prod real).

### Medio plazo (mes, ~3-5 días)
7. **RLS en Supabase** con políticas por rol (defensa en profundidad real).
8. **Sentry** con sampling de queries lentas + alertas.
9. **Backup automático verificado** (pg_dump cron + restore drill mensual).
10. **Virtual scrolling** en `/contacts` con `react-window` para tablas de 10k+ visibles.

### Largo plazo (trimestre)
11. **Redis caché** para queries calientes (top accounts, dashboard stats).
12. **Read replicas** si la carga de lectura supera la escritura por 10×.
13. **Particionamiento** de `AuditLog` y `Activity` por mes (cuando pasen los 5M de rows).

---

## 🏆 Grado actual

> **B+** para una app B2B de uso interno con < 10k contactos.
> **A−** después de los 3 items inmediatos del plan.
> **A** después del medio plazo.
> **A+** solo si llega a > 100k contactos y se aplica el largo plazo.

La base es sólida: schema bien diseñado, índices correctos, FK constraints completos, validación end-to-end. Lo que falta es **operacional** (migrations, backup, observabilidad) más que **estructural**.

---

## 📐 Comandos útiles para auditoría continua

```bash
# Tamaño y filas por tabla
psql $DATABASE_URL -c "
  SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_stat_user_tables WHERE schemaname='public'
  ORDER BY pg_total_relation_size(relid) DESC;"

# Queries lentas (requiere pg_stat_statements habilitado)
psql $DATABASE_URL -c "
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC LIMIT 10;"

# Índices no usados
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0
  ORDER BY tablename;"

# Backup manual
pg_dump $DIRECT_URL > backup-$(date +%Y%m%d-%H%M).sql
```
