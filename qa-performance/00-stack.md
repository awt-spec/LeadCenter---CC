# Fase 0 — Descubrimiento del stack

## Identidad del proyecto

**LeadCenter** — CRM interno de SYSDE Internacional (B2B fintech LatAm). Aunque
el repo se nombra como ERP-like, en la práctica es un CRM con pipeline de
ventas, gestión de cuentas/contactos, campañas, actividades, tareas y
reportes. Reciente migración masiva desde HubSpot + Asana → la DB pasó de
~100 contactos a ~30K, de 0 actividades a 121K, en ~7 días. **El reporte de
lentitud llega justo después de esa migración** — esto es un dato clave.

## Stack

### Frontend
- **Framework**: Next.js 15.5.15 — **App Router**, RSC dominante. La mayoría
  de páginas (`page.tsx`) son Server Components que hacen `await prisma...`
  directo. Pocos client components hacen `fetch` desde el navegador.
- **React**: 19.0.0 (Server Components 1ra clase, useTransition, etc.).
- **Bundler**: Next 15 default (Turbopack para dev, webpack para prod en
  build de Vercel).
- **UI**: Tailwind 3.4 + shadcn/ui (Radix primitives) + lucide-react. Sin
  styled-components. Tipografía Montserrat + Inter.
- **Tablas**: TanStack Table 8.20 (React Table v8) — sin virtualización
  configurada (relevante para listados grandes).
- **Charts**: Recharts 3.8.
- **Editor de texto**: Tiptap 2.10.
- **DnD**: @dnd-kit (pipeline kanban, task kanban, drag-reorder).
- **Estado del cliente**: **NINGUNA librería de estado global**. No hay
  React Query / SWR / Apollo. Toda la data fluye via:
    - Server Components con `await prisma.X.findMany(...)`.
    - Server Actions (`'use server'`).
    - `router.refresh()` + `revalidatePath()` para invalidación.

### Backend
- **No hay servicio separado.** Toda la lógica viene en Next.js:
    - **Páginas RSC** que llaman directo a Prisma.
    - **Server Actions** en `src/lib/**/mutations.ts`.
    - **API Routes** (`src/app/api/.../route.ts`) — sólo 21 rutas, mayormente
      para integraciones (HubSpot OAuth/webhooks/cron), uploads, AI, y un
      par de búsquedas. La UI casi no las usa para datos transaccionales.
- **Lenguaje**: TypeScript 5.7 estricto.
- **ORM**: Prisma 5.22 (sin Accelerate, sin Pulse).

### Base de datos
- **PostgreSQL** sobre **Supabase** (pooler PgBouncer en `aws-1-us-west-2`).
- 38 modelos Prisma. Extension `tsvector` para FTS en Contact + Account.
- Migrations aplicadas vía SQL targeted (algunas) + `prisma migrate deploy`
  durante el `vercel build`.

### Capa de cache
- **NO hay Redis ni Memcached.**
- Lo único: `unstable_cache` de Next.js (in-memory por instancia de
  función serverless en Vercel) usado en:
    - `src/app/(dashboard)/page.tsx` (dashboard, revalidate 60s)
    - `src/lib/accounts/queries.ts` (account-minimal + account-detail,
      revalidate 60-120s)
    - `src/lib/shared/lite-lists.ts` (contacts/accounts/opps/users lite,
      revalidate 300s)
- **Limitación clave**: Vercel hace cold-start frecuente; el cache se pierde
  entre instancias. No hay un cache compartido.

### Comunicación
- **REST + Server Actions**. NO WebSockets, NO GraphQL, NO SSE. Las
  actualizaciones son request/response + revalidatePath.

### Despliegue
- **Vercel serverless** (Hobby/Pro tier — no Enterprise).
- Cron de Vercel `*/5 min` para `/api/integrations/hubspot/cron`.
- Vercel Blob para storage de archivos (task attachments).
- Edge functions: ninguna en uso (todo `runtime: nodejs`).

### Auth
- NextAuth 5 beta.25 con `Credentials` (email + bcrypt). JWT (no DB session).
- 5 usuarios activos, 48 inactivos.

### Tests
- **No hay tests configurados.** No vitest, no jest, no playwright, no k6
  en `package.json`. Los scripts son sólo Prisma + dev/build.
- Esto significa que para Fase 4 voy a tener que **agregar harness de tests**.

### CI / observabilidad
- No hay GitHub Actions configuradas.
- No hay Sentry / DataDog / OpenTelemetry visible.
- Logging: `console.log` + `logger.X` ad-hoc. Vercel logs disponibles en su UI.

---

## Volumen de datos actual (snapshot DB de producción)

| Tabla | Filas |
|---|---|
| accounts | 3,111 |
| contacts | 29,774 |
| opportunities | 766 |
| **activities** | **121,094** ← tabla caliente más grande |
| tasks | 1,507 |
| taskComments | 0 |
| taskAttachments | 374 |
| users | 53 (5 activos) |
| **integrationMapping** | **159,715** ← lookups frecuentes |
| campaigns | 5 |
| notifications | 10 |
| auditLog | 44 |

Las tablas grandes (Activity, IntegrationMapping) son las que dominan las
queries hot path: timeline de cuenta, audit, sync de HubSpot.

---

## Módulos del CRM detectados

| Módulo | Ruta | Notas |
|---|---|---|
| Dashboard / home | `/` | Tabs: Resumen / Mi gestión / Gráficos |
| Accounts | `/accounts` + `/accounts/[id]` | Lista con tabs (Overview/Tasks/Activity/Contacts/Opps), detail con C.O.C. |
| Contacts | `/contacts` + `/contacts/[id]` | Toggle "Por contacto / Por cuenta", tabla TanStack |
| Opportunities | `/opportunities` + `/opportunities/[id]` | Lista + detail con tabs (Info/Contacts/Activity/Checkpoints/History) |
| Pipeline | `/pipeline` | Kanban drag-drop |
| Campaigns | `/campaigns` + detalle | Audience builder, AI drafts |
| Activities | `/activities` | Timeline global |
| Reports | `/reports` | Tabs Resumen + Extractor IA |
| Heatmap | `/heatmap` | Engagement por cuenta × semana |
| Sprint | `/sprint` | Board kanban + Auditoría (Marketing / BD) |
| Inbox | `/inbox` | Próximas acciones |
| Settings | `/settings/{users,roles,custom-fields,integrations}` | |

---

## Patrones a auditar (foco para Fase 1)

Ya identifiqué arquitectónicamente algunos patrones que vale la pena
sondear con detalle:

1. **Server Components hacen Prisma directo en cada navegación** — sin
   cliente cache compartido entre rutas. Cada pageview = round-trip a
   Supabase. Si hay un cold start o el pool está lento, se siente.

2. **`unstable_cache` + Vercel serverless** — cuando una función es cold,
   el cache está vacío. Al deployar, todos los caches se invalidan.

3. **121K activities** — todos los timelines de cuenta filtran sobre
   `accountId + occurredAt`. Ya agregué índices compuestos en commits
   anteriores; toca verificar EXPLAIN ANALYZE post-fix.

4. **Sin React Query / SWR** — re-fetches del cliente (cuando los hay)
   no comparten cache entre componentes. Ej: `/api/accounts/[id]/contacts-mini`
   se llama cada vez que el composer se abre.

5. **Tablas TanStack sin virtualización** — `/contacts` con 50 filas por
   página está bien, pero `/accounts` y `/opportunities` cargan todo lo
   filtrado en cada render.

6. **Sin compresión / cache headers explícitos** — Vercel maneja gzip/brotli
   por default en HTML/JS, pero respuestas JSON de API no tienen
   `Cache-Control` ni `ETag`.

7. **`PrismaClient` log = `error,warn` en prod** ✅ está bien — `query` log
   en prod sería un asesino.

8. **Cron HubSpot cada 5 min** corre lecturas + escrituras pesadas. Si un
   tick coincide con uso real, la DB compite por conexiones.

---

## Pregunta antes de avanzar a Fase 1

¿Te parece bien proseguir con Fase 1 con este alcance?

Algunas decisiones de método que necesito confirmar:

1. **Tests**: como no hay framework configurado, propongo agregar
   **Vitest** (lightweight, rápido, compatible con Next 15) para los tests
   de Fase 4. Para benchmarks de carga propongo **autocannon** (Node.js,
   no requiere Java como JMeter). ¿OK?

2. **Mediciones contra prod o staging**: el repo apunta a Supabase
   producción. Para no contaminar la DB con tráfico de benchmark, propongo:
   - Medir SOLO con `EXPLAIN ANALYZE` en DB para queries hot.
   - Para latencias end-to-end, levantar `next dev` localmente apuntando
     a la misma DB de prod (riesgo bajo, sólo lecturas).
   - Si querés algo más limpio puedo crear una DB Supabase de staging
     con un dump de prod — toma ~15 min extra.

3. **Alcance**: el reporte de "navegación lenta" es genuino y hay
   evidencia. Ya hice optimizaciones previas (índices compuestos,
   GROUP BY agregados, payload reducido) — pero nunca medí formalmente.
   Esta Fase 0/1/2 sirve para **validar** que esos fixes funcionan + cazar
   los bottlenecks que quedan.

4. **Branch**: ya estoy en `perf/qa-navegacion-erp` ✅

Avísame si arranco Fase 1.
