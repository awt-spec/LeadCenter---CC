-- OPT-005: backfill accountId en Activity desde el contact linkeado
--
-- Antes de este fix, listActivities filtraba por
--   WHERE accountId=X OR opportunity.accountId=X OR contact.accountId=X
-- que tomaba 1.5-19s en cuentas hot porque Postgres no podía elegir un
-- único índice. El composite Activity_accountId_occurredAt_idx existe
-- pero la rama OR del query lo descarta.
--
-- Solución: garantizar que TODAS las activities accionables tengan
-- accountId directo. Después el filter es un simple `accountId = X`
-- que walks el composite ordenado y para en LIMIT.
--
-- Backfill: para cada activity con contactId pero sin accountId, copiar
-- el accountId del contacto (cuando existe).
-- 1,834 rows updated en producción al primer run.
-- Quedan ~1,670 activities con contact sin account asignado — son
-- "orphans" que nunca aparecen en ningún timeline de cuenta de todas
-- formas, así que no rompemos nada.

UPDATE "Activity" a
   SET "accountId" = c."accountId"
  FROM "Contact" c
 WHERE a."contactId" = c.id
   AND a."accountId" IS NULL
   AND a."contactId" IS NOT NULL
   AND c."accountId" IS NOT NULL;

ANALYZE "Activity";
