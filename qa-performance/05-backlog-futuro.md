# Fase 4+ — Backlog futuro (out of scope para esta auditoría)

Items detectados pero NO aplicados. Cada uno tiene su justificación de por
qué se quedó afuera del lote actual y cuándo conviene encararlo.

## Performance

### OPT-005 — Refactorizar `listActivities` para evitar OR sobre 3 paths

**Por qué**: el bench post-fix mostró que `WHERE accountId=X OR opp.accountId=X
OR contact.accountId=X` sigue tomando 1.7s. El composite ayuda solo cuando se
filtra por un único path. El OR fuerza a Postgres a hacer 3 index scans +
union + sort.

**Solución sugerida**:
- Fetch IDs de opps + contacts del account primero (queries baratas con sus
  composites).
- Después: `WHERE accountId IN (X) OR opportunityId IN (oppIds) OR
  contactId IN (contactIds)` — todos usan IN sobre el campo indexado.
- Alternativa más simple: el timeline de account muestra SOLO activities
  con `accountId=X` directo. Las indirectas vía opp/contact ya están
  visibles en la pestaña de cada opp/contact. Cambia un poco la UX pero
  es 50× más rápido.

**Esfuerzo**: M.

### OPT-006 — `loadPipeline` sin paginación

**Por qué**: con 766 opps actuales el query corre <1s. Pero sin take,
crece linealmente. A los 5K opps va a doler.

**Solución**: take 1000 + mensaje "filtros para refinar".

### OPT-007 — Cache `loadUserPermissions`

**Por qué**: 670ms p50 en cada login + cada JWT update. Pasa <2 veces por
día por user, no es bottleneck inmediato.

**Solución**: `unstable_cache` por userId, revalidate 5 min, invalidate tag
`permissions` al editar roles.

### OPT-009 — Cron HubSpot bajar concurrency 8→4

**Por qué**: cuando un tick coincide con uso real, la pool de Supabase free
compite. No hay evidencia de que sea bottleneck observable hoy.

### OPT-010 — Cache-Control headers en API JSON

**Por qué**: actual `NextResponse.json` no agrega cache headers. Los endpoints
idempotentes (`/api/accounts/[id]/contacts-mini`, `/api/tasks/[id]`) podrían
beneficiarse de `Cache-Control: private, max-age=60, stale-while-revalidate=300`.
Mejora navegación back/forward del browser.

### OPT-013 — React Query / SWR

**Por qué**: actualmente cada componente que hace `fetch(/api/...)` no comparte
cache con otros componentes del mismo viaje. Beneficio compuesto en navegación
"abrir-cerrar-abrir" del mismo recurso.

**Esfuerzo**: M (3-4 archivos clave + integración).

### OPT-016 — Cache shared persistente (Vercel KV)

**Por qué**: `unstable_cache` se evapora en cada cold start. Equipo chico → poco
tráfico → funciones frías frecuentes.

**Esfuerzo**: M (setup KV + helper).

## Hallazgos colaterales

### OPT-019 — `pipeline/forecast.ts` 3 findMany sin take

**Por qué**: con 766 opps OK. Si crece sería problema.

### OPT-020 — `prisma.contact.findMany take=500` en `/contacts/new`

**Por qué**: el dropdown de cuentas del nuevo contacto carga 500 filas. Migrar
a Combobox con search async.

### OPT-021 — `getAccountByIdRaw` aún incluye 50 contactos + 30 opps

**Por qué**: aunque las pestañas re-fetchean, el initial load aún trae lo que
no se ve. Bajar a 5+5 reduce payload inicial ~30%.

## Limpieza pendiente

- `prisma/import-asana/cache/dump.json` (72MB) sigue commiteado en el repo —
  agregar a `.gitignore` + `git rm --cached`.
- 38 modelos Prisma — algunos parecen no usarse. Auditar.
