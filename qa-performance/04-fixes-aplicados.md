# Fase 4 — Fixes aplicados

5 fixes con tests, 5 commits atómicos en branch `perf/qa-navegacion-erp`:

| ID | Commit | Estado test | Tiempo |
|---|---|---|---|
| OPT-001 | `e6dc3c2` | 2/2 ✅ | 25 min |
| OPT-002 | `82e99eb` | 1/1 ✅ (guard) | 5 min |
| OPT-003 | `c1fd8e1` | 3/3 ✅ | 5 min |
| OPT-004 | `8dba1e9` | 3/3 ✅ | 5 min |
| OPT-008 | `a7f470f` | 2/2 ✅ | 5 min |

Total: **45 min · 11/11 tests pasando**.

---

## OPT-001 (commit `e6dc3c2`) — fix masivo del planner

**Problema**: el planner elegía `Activity_occurredAt_idx` (single col) y filtraba 94K filas para devolver 25.

**Acción**:
1. `DROP INDEX` de los 4 single-col redundantes en Activity.
2. Re-crear los composites SIN partial WHERE (cuando se removieron los single, el planner descartaba los partial y caía a Seq Scan).

**Sub-incidente**: 7-8 conexiones de Prisma quedaron leak-eadas como `idle in transaction` bloqueando los DROP. `pg_terminate_backend()` las limpió.

**Test**: `qa-performance/__tests__/opt-001-activity-index.test.ts`
- ✅ EXPLAIN usa `Activity_accountId_occurredAt_idx`
- ✅ NO usa `Activity_occurredAt_idx` (single col)
- ✅ Query <1s

---

## OPT-002 (commit `82e99eb`) — guard para pipeline

**Hallazgo**: la query base ya corre en ~1ms gracias al `Opportunity_status_idx` + Sort top-N. El bottleneck del 440ms del bench original viene del INCLUDE de relaciones, no del filter+sort. **No agrego composite ahora**, dejo guard.

**Test**: `qa-performance/__tests__/opt-002-pipeline-index.test.ts`
- ✅ NO Seq Scan
- ✅ Execution Time < 100ms

Si las opps crecen a >5K y este test falla, ese será el momento de agregar `(status, stageChangedAt DESC)`.

---

## OPT-003 (commit `c1fd8e1`) — `take` en `getOpportunityById`

**Problema**: contactRoles, stageHistory, checkpoints sin límite. Una opp con muchos cambios traía todo en cada visita.

**Cambios**: take 50 / 50 / 100 respectivamente.

**Test**: `qa-performance/__tests__/opt-003-opportunity-includes.test.ts`
3/3 passing — verifica los caps por arrays.

---

## OPT-004 (commit `8dba1e9`) — `take` en `getTaskById`

**Problema**: subtasks, comments, attachments sin límite.

**Cambios**:
- subtasks: take 30
- comments: take 50 (ahora orderBy desc — los recientes primero)
- attachments: take 20

**Test**: `qa-performance/__tests__/opt-004-task-includes.test.ts`
3/3 passing.

---

## OPT-008 (commit `a7f470f`) — `writeAuditLog` fire-and-forget

**Problema**: cada login bloqueaba esperando que `auditLog.create` terminara. Idem signOut.

**Cambios**: `await writeAuditLog(...)` → `void writeAuditLog(...).catch(() => undefined)` en jwt callback (login) + signOut event.

**Test**: `qa-performance/__tests__/opt-008-audit-async.test.ts`
- ✅ No hay `await writeAuditLog(`
- ✅ Cada call site usa `void` o `.catch`
