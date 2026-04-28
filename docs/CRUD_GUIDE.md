# Guía CRUD — Lead Center

Cómo funciona cada módulo del sistema: qué entidades hay, dónde se crean / leen / editan / borran, qué permisos se necesitan y qué efectos colaterales tiene cada acción.

---

## Tabla resumen

| Entidad | URL listado | Crear | Editar | Borrar | Permiso edit | Permiso delete |
|---|---|---|---|---|---|---|
| **Contacto** (Base de datos) | `/contacts` | `/contacts/new` | `/contacts/[id]/edit` | botón en `/contacts/[id]` | `contacts:update:all` o `:own` | `contacts:delete` |
| **Cuenta (Empresa)** | `/accounts` | `/accounts/new` | `/accounts/[id]/edit` | botón en `/accounts/[id]` | `accounts:update:all` o `:own` | `accounts:delete` |
| **Oportunidad** | `/opportunities` | `/opportunities/new` | `/opportunities/[id]/edit` | botón en `/opportunities/[id]` | `opportunities:update:all` o `:own` | `opportunities:delete` |
| **Actividad** | `/activities` | composer (cualquier detail) | inline en card | menú card | crea: `activities:create` | edit/delete: own |
| **Campaña** | `/campaigns` | `/campaigns/new` | `/campaigns/[id]/edit` | botón en `/campaigns/[id]` | rol `admin` o `senior_commercial` | rol `admin` o `senior_commercial` |
| **Tarea** | tab **Tareas** en `/accounts/[id]` | dialog "Nueva tarea" | drawer click en card | drawer "Eliminar tarea" | session iniciada | autor o admin |
| **Usuario** | `/settings/users` | (no UI invitar todavía) | toggle de roles inline | (no UI deactivate) | rol `admin` | — |
| **Rol** | `/settings/roles` | matriz (no se crean roles, solo permisos) | toggle de permisos | — | rol `admin` | — |

---

## 1. Contacto (Base de datos madre)

### Listado — `/contacts`
- KPIs y filtros: país, status, source, owner, segmento, tags, productos de interés.
- Buscador por nombre / email / empresa.
- Búsqueda con índices: `email`, `fullName`, `companyName`, `(status, ownerId)`, `(accountId, status)`, `marketSegment`, `source`. Listo para 100k+ registros.
- Botones: **Importar CSV**, **Exportar CSV**, **Nuevo contacto**.

### Crear — `/contacts/new`
**Formulario** con 4 secciones:
1. **Identidad**: email (único), firstName, lastName, jobTitle, department, seniority.
2. **Empresa**: companyName (texto libre) + **Cuenta vinculada** (select FK a Account → unifica con la empresa real).
3. **Contacto**: phone, mobilePhone, country, city, linkedinUrl, website.
4. **Negocio**: source, sourceDetail, status, owner, marketSegment, productInterest, tags, opt-in, doNotContact, notas.

**Acción**: `createContact(input)` en [src/lib/contacts/mutations.ts](../src/lib/contacts/mutations.ts).
- Valida con Zod (rechaza email mal formateado, etc.)
- Crea el contacto + tags
- `AuditLog.action = 'create'`
- Revalida `/contacts`

### Leer — `/contacts/[id]`
- Card cabecera con avatar, status, source, doNotContact.
- Tabs: **Información**, **Actividad** (timeline + composer).
- Sidebar derecho: cuenta vinculada, owner, oportunidades, audit log.

### Editar — `/contacts/[id]/edit`
- Mismo form que crear, prepoblado.
- **Acción**: `updateContact(id, input)`. Diff entre before/after se guarda en `AuditLog.changes`.
- Revalida `/contacts` y `/contacts/[id]`.

### Borrar — botón "Eliminar" en `/contacts/[id]`
- `DeleteResourceButton` con AlertDialog + nombre del contacto.
- **Acción**: `deleteContact(id)`. Cascadeo: tags, mentions y participaciones en activities se borran (Prisma onDelete: Cascade). Activities mismas no, quedan huérfanas.
- Redirige a `/contacts`.

### Importar CSV — `/contacts/import`
- Drag & drop o picker de archivo.
- Auto-detecta columnas con `autoDetectMapping` ([csv-mapper.ts](../src/lib/contacts/csv-mapper.ts)) — soporta español, inglés y headers Notion (`headline`, `locality`).
- 3 estrategias de dedupe: SKIP / UPDATE / CREATE_NEW.
- Stream batch en `ImportBatch` con métricas (creados / actualizados / saltados / fallados).

### Exportar CSV — botón en `/contacts`
- `GET /contacts/api/export` con todos los filtros activos.
- Hasta 10.000 filas, snake_case headers, UTF-8 con BOM.
- RBAC: requiere `contacts:export_csv`.

---

## 2. Cuenta / Empresa

### Listado — `/accounts`
- Tabla con `<DataTable>`: nombre + dominio, país, segmento, tamaño, **prioridad inline editable** (4 niveles), status, owner, contadores, pipeline total.
- Click en una fila navega a `/accounts/[id]`.
- Click en el pill de prioridad → dropdown que cambia inline (optimistic + audit).
- Botones: **Exportar CSV**, **Nueva cuenta**.

### Crear — `/accounts/new`
**Form**: name, legalName, domain (único), website, segment, industry, size, employeeCount, annualRevenue, country/region/city/address, status, priority, owner, parentAccount, description, internalNotes.

**Acción**: `createAccount(input)`.

### Leer — `/accounts/[id]`
**Cabecera** con priority badge, status, edit + delete.
**Tabs:**
1. **Overview** — campos completos, jerarquía si tiene padre.
2. **Tareas** — Kanban estilo Asana (ver §6).
3. **Actividad** — timeline + composer.
4. **Contactos** — lista de contacts con `accountId = este`.
5. **Oportunidades** — lista de opps con drill-down.
6. **Jerarquía** — solo si tiene padre o hijos.

### Editar — `/accounts/[id]/edit`
- Mismo form que crear.
- `updateAccount(id, input)` con diff.

### Borrar — botón en `/accounts/[id]`
- `deleteAccount(id)`. Cascadeo agresivo: borra contactos vinculados, opportunities, activities y tasks de la cuenta. **Cuidado**: usa con responsabilidad.

### Inline actions
- **Cambiar prioridad** desde la tabla del listado: `setAccountPriority(id, priority)`.
- **Cambiar status** desde la tabla (vía mismo dropdown): `setAccountStatus(id, status)`.

---

## 3. Oportunidad

### Listado — `/opportunities`
- Tabla con stage, rating, valor, owner, días en stage, próxima acción.
- Toggle vista **Tabla / Kanban** (Kanban va a `/pipeline`).
- Filtros: producto, fase, owner, rating, país, segmento, modelo comercial, valor min/max, fecha cierre, mías, vencidas, stale 7d.
- Botones: **Exportar CSV**, **Nueva oportunidad**.

### Crear — `/opportunities/new`
**Form** denso (es la entidad más rica):
- Identidad: name, code, account (FK obligatoria).
- Producto: SAF+ / FILEMASTER / FACTORAJE_ONCLOUD / SYSDE_PENSION / SENTINEL_PLD / CUSTOM + sub-producto.
- Comercial: stage, rating, probability, estimatedValue, currency, commercialModel.
- Sizing: portfolioAmount, userCount, annualOperations, clientCount, officeCount.
- Fechas: expectedCloseDate, lastActivityAt, nextActionDate, nextActionNote.
- Source / referrer.
- Owner, descripción, notas internas.
- Contactos: agregar roles (sponsor, decision maker, champion, etc.).

**Acción**: `createOpportunity(input)`.
- Crea + StageHistory inicial + asocia contactos.

### Pipeline Kanban — `/pipeline`
- Drag-drop entre stages → `changeOpportunityStage`.
- Stages "críticas" (WON/LOST/STAND_BY/NURTURE) abren **dialog de confirmación**.
- WON requiere wonReason y monto final; LOST requiere lostReason.
- Quick-view sheet: click una sola vez en una card.
- Filtros guardables vía URL (compartibles).

### Editar — `/opportunities/[id]/edit`
- Mismo form denso.
- `updateOpportunity(id, input)`.

### Borrar — `/opportunities/[id]` → `<DetailActions>` con dropdown
- `deleteOpportunity(id)`.

### Cambio de fase — `<StageBadge>` o drag-drop pipeline
- `changeOpportunityStage(id, toStage, payload)` en mutations
- Crea entrada en `StageHistory`
- Actualiza `Opportunity.stage`, `stageChangedAt`, `previousStage`
- Si stage = WON: marca `closedAt`, requiere `wonReason`
- Si stage = LOST: marca `closedAt`, requiere `lostReason`

---

## 4. Actividad

### Listado — `/activities`
- KPIs: esta semana, acciones pendientes, mis menciones, vencidas.
- Timeline agrupado por día (Hoy, Ayer, fechas).
- Filtros: tipo, tags, autor, fecha desde/hasta, pendientes, mis menciones, incluir generadas por sistema.
- Cards con todo: header (tipo + tag + outcome), body (rich-text Tiptap), próxima acción, **adjuntos**, **responsables**, links a entidades, footer con autor + fecha.

### Crear — composer (botón "Actividad" en cualquier detail)
**Tipos**: CALL / EMAIL_SENT / EMAIL_RECEIVED / WHATSAPP / MEETING / DEMO / MATERIAL_SENT / PROPOSAL_SENT / INTERNAL_NOTE / TASK / LINKEDIN_MESSAGE / EVENT_ATTENDED.

**Templates** preconfigurados según tipo (call_quick, discovery_meeting, demo_executive, proposal_sent, etc.).

**Form**:
- Type + subject + body Tiptap (con @menciones).
- Tags: BL / INFO / CONSUL / SOLIC / URGENT / FOLLOWUP / WIN_SIGNAL / RISK_SIGNAL.
- Outcome: POSITIVE / NEUTRAL / NEGATIVE / BLOCKER / NO_RESPONSE.
- Próxima acción: tipo + fecha + asignado + nota.
- Vinculaciones: contact, account, opportunity (auto-pobladas según contexto).
- Participants (contacts presentes en una reunión).

**Acción**: `createActivity(input)`. Crea Activity + mentions (notificaciones a usuarios mencionados) + sync de `nextActionDate` en la opportunity.

### Multi-responsables (NUEVO)
En cada activity card, footer:
- Avatares apilados de responsables actuales.
- Click un avatar → quita responsable.
- Botón **+** abre popover con search → multi-select para asignar.
- Acciones: `assignActivity(id, userIds[])`, `unassignActivity(id, userId)`.
- Notifica a cada nuevo asignado.

### Adjuntos (NUEVO)
- Botón **"Adjuntar"** en cada activity card.
- Dialog: pegar URL externa (Drive / Dropbox / Notion / etc.) + nombre opcional.
- Iconos por tipo de archivo (image, video, pdf, spreadsheet, zip).
- Click abre en nueva tab, hover muestra X para borrar.

### Editar / borrar
- `updateActivity(id, input)` — solo el creator puede.
- `deleteActivity(id)` — solo el creator (o admin).
- `completeNextAction(id)` — marca la próxima acción como completada.

---

## 5. Campaña

### Listado — `/campaigns`
- KPIs: total, activas, completadas, opps atribuidas.
- Cards grid con status pill, tipo, goal, contadores (contactos / opps / steps), pipeline atribuido, fecha inicio.

### Crear — `/campaigns/new`
**Form**:
- Identidad: name, code (único), description.
- Tipo (9 opciones: EMAIL_DRIP, COLD_OUTBOUND, WEBINAR, EVENT, REFERRAL, CONTENT, PARTNER, PAID_ADS, MIXED).
- Status (DRAFT / ACTIVE / PAUSED / COMPLETED / ARCHIVED).
- Goal (AWARENESS / LEAD_GEN / CONVERSION / RETENTION / REFERRAL / EVENT_REGISTRATION).
- Targeting: segmento, país.
- Fechas + presupuesto + gastado + currency.

**Acción**: `createCampaign(input)`. Solo `admin` o `senior_commercial`.

### Leer — `/campaigns/[id]`
**4 tabs:**
1. **Resumen** — funnel custom (Enrolados → Activos → Respondió → Convertido), pie de status, bar de pipeline por fase, **ROI calculado** (`(wonValue / spent) - 1`).
2. **Flujo** — secuencia de pasos visual con icons por tipo (email, espera, llamada, tarea, LinkedIn, WhatsApp, evento, branch).
3. **Contactos** — lista enrolada + **botón "Enrolar contactos"** (dialog con search en toda la base + multi-select + bulk enroll).
4. **Oportunidades** — opps con `campaignId = esta`.

### Pasos del flujo
- Tipos: EMAIL / WAIT / CALL / TASK / LINKEDIN / WHATSAPP / EVENT_INVITE / BRANCH.
- Cada paso: nombre, espera previa (días), contenido (subject/body para email, script para call, etc.).
- **Crear paso**: dialog con form contextual al tipo.
- **Eliminar paso**: botón con confirmación.
- (Pendiente: drag-drop para reordenar.)

### Enrolar contactos
- Botón en tab **Contactos**.
- Dialog con search por nombre/email/empresa (debounced).
- Multi-select de contactos no enrolados.
- Submit → `enrollContactsBulk(campaignId, contactIds[])` con `skipDuplicates`.

### Editar / borrar
- `/campaigns/[id]/edit` con form completo.
- Botón "Eliminar" en detail.
- Cambio de status puede ser inline (`setCampaignStatus`).

---

## 6. Tarea (estilo Asana, en cada cuenta)

### Ubicación
Tab **"Tareas"** dentro de `/accounts/[id]`.

### Listado — Kanban
**6 columnas**: Backlog / Por hacer / En progreso / En revisión / Bloqueadas / Completadas.

Drag-drop entre columnas → cambia status (`setTaskStatus`).

### Crear — botón "Nueva tarea"
**Dialog**:
- Título (obligatorio), descripción.
- Status, prioridad (LOW / NORMAL / HIGH / URGENT).
- Vencimiento.
- Tags (separados por coma).
- Multi-responsables (toggle pills con avatar).

**Acción**: `createTask(input)`. Notifica a cada responsable.

### Leer / editar — drawer (Sheet)
Click en una card abre drawer derecho con todo:
- Título editable inline (blur guarda).
- Selects de status y priority (con dot color).
- Vencimiento como date input.
- Toggle de responsables (pills clickeables).
- Descripción (textarea, blur guarda).
- Subtareas listadas con su status.
- **Adjuntos**: paste-URL + nombre opcional, listados con autor.
- **Comentarios**: timeline tipo chat. Cada comentario con avatar, autor, fecha. Cmd+Enter para enviar. Delete-own.
- Botón "Eliminar tarea" abajo.

### Acciones
| Acción | Función |
|---|---|
| Crear | `createTask(input)` |
| Update | `updateTask(id, partial)` |
| Cambiar status | `setTaskStatus(id, status)` |
| Cambiar priority | `setTaskPriority(id, priority)` |
| Borrar | `deleteTask(id)` |
| Comentar | `addTaskComment({ taskId, body })` |
| Borrar comentario | `deleteTaskComment(id)` (solo autor) |
| Adjuntar | `addTaskAttachment(taskId, fileName, fileUrl)` |
| Borrar adjunto | `deleteTaskAttachment(id)` |

### Indicadores en card
- Dot de prioridad.
- Fecha vencida en rojo, hoy en ámbar.
- Badges de subtareas / comentarios / adjuntos si los hay.
- Avatares de responsables apilados.

---

## 7. Usuario y Rol (RBAC)

### `/settings/users`
- Lista de todos los usuarios con avatar, email, último login, estado activo/inactivo.
- **Si eres admin**: cada usuario tiene los 6 roles como pills clickeables. Toggle on/off → `assignUserRole(userId, roleId, enabled)` con audit log.
- Si NO eres admin: chips read-only.

### `/settings/roles`
- Solo admin.
- Tabla matriz: filas = permisos (agrupados por recurso: contactos, cuentas, oportunidades, actividades, reportes, usuarios, settings, audit), columnas = los 6 roles.
- Click en cualquier celda → toggle permiso (optimistic).
- Acción: `togglePermission(roleId, permissionId, enabled)`.
- Rol **admin** está bloqueado por diseño (siempre tiene todo).

### Roles del sistema
| Key | Nombre | Permisos clave |
|---|---|---|
| `admin` | Administrador | TODOS (36 permisos) |
| `senior_commercial` | Comercial Senior | leer todo, crear/editar own, change_stage, exportar |
| `sdr` | SDR / Outbound | importar CSV, leads, opps own |
| `reviewer` | Revisor | solo lectura global + crear actividades |
| `functional_consultant` | Consultor | leer y comentar opps asignadas |
| `external_partner` | Partner Externo | acceso muy restringido |

### Crear nuevos roles
Hoy no hay UI para crear roles desde 0 — están seedeados como `isSystem: true`. Para añadir uno nuevo: agregar al `prisma/seed.ts` y re-correr `pnpm db:seed`.

---

## 8. Demo / Login bypass

### Cómo entrar como demo
- En `/login`, botón **"Entrar como demo"** → loguea como `demo@sysde.com` con rol `admin`.
- Backend: `isDemoCredentials(email, password)` en [src/lib/demo.ts](../src/lib/demo.ts) → corto-circuito en `Credentials.authorize` que NO toca DB y devuelve `{ id: 'demo-user', ... }`.
- El JWT del demo trae `permissions = DEMO_PERMISSIONS` (todos los keys hard-codeados) — no consulta DB.

### Cuando se sale de demo
- `signOut` con userId === `demo-user` no se loguea en audit.

---

## 9. Auditoría

### Cada mutation escribe en `AuditLog`
Campos: `userId`, `action`, `resource`, `resourceId`, `changes` (JSON), `ipAddress?`, `userAgent?`, `createdAt`.

Eventos típicos:
- `create`, `update`, `delete` — resource = nombre tabla.
- `stage_change`, `priority_change`, `status_change` — opportunities / accounts.
- `permission_grant` / `permission_revoke` — roles.
- `role_grant` / `role_revoke` — users.
- `enroll_bulk` / `enroll` / `unenroll` — campaigns.
- `step_add` / `step_delete` — campaign flow.
- `comment_add` — tasks (próximamente standardizado a todo).
- `attachment_add` / `attachment_delete` — tasks / activities.
- `login`, `logout` — auth.

Hoy no hay UI para ver el AuditLog (solo está la query). Para verlo: `pnpm prisma studio` y navegar a la tabla.

---

## 10. Notificaciones

### Generadas automáticamente
| Trigger | Tipo |
|---|---|
| Mencionan a un user en un activity body Tiptap | `MENTION` |
| Se asigna un activity a un user | `ASSIGNED_NEXT_ACTION` |
| Una `nextActionDate` está vencida | `NEXT_ACTION_DUE` |
| Se cambia de fase una opp owned | `STAGE_CHANGED` |
| Se asigna una task a un user | `ASSIGNED_NEXT_ACTION` |

### UI
- Bell en la topbar muestra unread count.
- Click abre dropdown con la lista (link a la entidad).
- `/inbox` tiene tabs: Menciones / Acciones asignadas / Mis actividades.

---

## 11. Import / Export

### Contactos (`/contacts/import`)
- Drag & drop CSV.
- Auto-detecta columnas (`email`, `firstName`, `lastName`, `companyName`, `jobTitle`, `headline`, `locality`, `linkedinUrl`, `phone`, etc).
- Soporta CSVs de **Notion** (Fincomercio CSV: 9 columnas auto-mapeadas).
- 3 estrategias dedupe: SKIP / UPDATE / CREATE_NEW.
- Tracking de batch: rows totales, creados, actualizados, saltados, errores.

### Export
- **Contactos**: `/contacts/api/export` → CSV con todos los filtros activos. Botón **Exportar CSV** en la página.
- **Cuentas**: `/accounts/api/export`.
- **Oportunidades**: `/opportunities/api/export`.

Cap: 10.000 filas por export. Headers snake_case, UTF-8.

---

## Convenciones técnicas

### Validación
- Toda input externa pasa por **Zod** schemas en `src/lib/<module>/schemas.ts`.
- Mismo schema lo usa el form (cliente) y la mutation (server).

### RBAC primero
- Cada server action / página llama `can(session, 'recurso:accion[:scope]')` antes de tocar la DB.
- Si falla, retorna 403 / `<Forbidden>`.

### Audit log
- Cada mutation escribe en `AuditLog` con `userId`, `action`, `resourceId`, `changes` (JSON diff).

### Revalidación
- Después de cada mutation: `revalidatePath('/lista')` y `revalidatePath('/lista/[id]')` para refrescar SSR cache.

### Optimistic updates
- Pickers de prioridad / status / asignados aplican el cambio en el cliente y revierten si la action falla. Toast de error.

### Demo bypass
- Email `demo@sysde.com` + password `demo1234` corto-circuita el credentials provider sin DB. Inseguro en prod, por eso vive detrás de un check explícito en código.

---

## Verificación

Para correr smoke tests de todos los CRUDs end-to-end:

```bash
# Login
CSRF=$(curl -s -c /tmp/c.txt http://localhost:3000/api/auth/csrf | jq -r .csrfToken)
curl -s -b /tmp/c.txt -c /tmp/c.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "email=demo@sysde.com" --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "callbackUrl=http://localhost:3000/" \
  --data-urlencode "json=true"

# Smoke test todas las rutas
for p in / /pipeline /accounts /contacts /opportunities /activities /campaigns /reports /inbox /settings/users /settings/roles; do
  curl -s -b /tmp/c.txt -o /dev/null -w "%{http_code}  $p\n" "http://localhost:3000$p"
done
```

---

## Lo que falta (para release v2)

- 🔄 **Drag-drop reorder** de campaign steps y subtareas.
- 📎 **Upload nativo** de archivos (hoy paste-URL) — Vercel Blob.
- 🔍 **Full-text search** Postgres con tsvector + GIN para 100k+ contactos.
- 📜 **Cursor-based pagination** en listados grandes (offset > 5000 es lento).
- 🪟 **Virtual scrolling** con `react-window` en tablas largas.
- 📧 **Email automation real** con Resend (hoy las campañas son visualizadas, no envían).
- 📅 **Sync calendario** con Google Calendar.
- ⚡ **Realtime** (Supabase Realtime o Pusher) para colaboración en vivo.
- 📊 **Audit log viewer** UI (hoy solo Prisma Studio).
- 🌙 **Dark mode** + más animaciones (Sprint 3 del roadmap).
- ✅ **Tests E2E** (Playwright) para los flujos críticos.
