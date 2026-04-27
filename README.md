# Lead Center · SYSDE Internacional

CRM interno de SYSDE Internacional Inc. para reemplazar el uso de Asana como CRM comercial. Este repositorio contiene la Fase 1 (fundación): autenticación, RBAC, layout base y placeholders de los módulos de negocio que se implementarán en fases posteriores.

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript (strict)
- **UI:** Tailwind CSS v3 + shadcn/ui + Lucide icons
- **DB:** PostgreSQL gestionado por Supabase, accedido vía Prisma ORM
- **Auth:** NextAuth v5 (Auth.js) con Google Provider (`hd: sysde.com`) y Credentials
- **Validación:** Zod + React Hook Form
- **Email:** Resend (configurado, no usado aún)
- **Package manager:** pnpm

## Setup local

1. **Clonar el repo**
   ```bash
   git clone <repo-url>
   cd leadcenter-sysde
   ```

2. **Instalar dependencias**
   ```bash
   pnpm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con:
   - `DATABASE_URL` y `DIRECT_URL` de Supabase (Settings → Database → Connection string)
   - `AUTH_SECRET`: generar con `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` del OAuth consent screen
   - `SEED_ADMIN_PASSWORD`: contraseña temporal para el admin inicial

4. **Crear proyecto en Supabase** y pegar los connection strings en `.env.local`.

5. **Ejecutar migraciones**
   ```bash
   pnpm prisma migrate dev
   ```

6. **Seed de roles, permisos y usuario admin**
   ```bash
   pnpm prisma db seed
   ```

7. **Arrancar el servidor de desarrollo**
   ```bash
   pnpm dev
   ```

Visita `http://localhost:3000`. Serás redirigido a `/login`. Usa las credenciales del admin seed (`alwheelock@sysde.com` + `SEED_ADMIN_PASSWORD`) o el botón de Google con una cuenta `@sysde.com`.

## Estructura de carpetas

```
leadcenter-sysde/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Sidebar + topbar
│   │   │   ├── page.tsx            # Home (placeholder)
│   │   │   ├── contacts/
│   │   │   ├── accounts/
│   │   │   ├── opportunities/
│   │   │   ├── pipeline/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   └── auth/[...nextauth]/route.ts
│   │   ├── globals.css
│   │   └── layout.tsx              # Root layout
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   └── user-menu.tsx
│   │   └── shared/
│   ├── lib/
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── db.ts                   # Prisma client singleton
│   │   ├── rbac.ts                 # Lógica de permisos
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── types/
│   │   └── index.ts
│   ├── middleware.ts               # Protección de rutas
│   └── env.ts                      # Validación de env con Zod
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Convenciones de código

- **TypeScript strict** activado, no se permite `any` implícito ni explícito salvo justificación.
- **Server Actions** preferidas sobre API routes para mutaciones internas.
- **Server Components** por defecto; pasar a Client (`'use client'`) solo cuando haya interactividad o hooks del browser.
- **Validación en el boundary:** todo input externo (forms, CSV, API) se valida con Zod.
- **RBAC primero:** toda página/server action protegida pasa por `can()` / `requirePermission()` antes de ejecutar lógica.
- **Audit log:** mutaciones de negocio y eventos de auth escriben en `AuditLog`.
- **Diseño:** tokens en `tailwind.config.ts` (`sysde.*`). Nunca usar colores fuera de la paleta SYSDE (prohibido `#2468C4`, gradientes, itálicas, uppercase en UI interna).

## Roles y permisos

La Fase 1 seedea 6 roles del sistema:

| Key | Nombre |
|---|---|
| `admin` | Administrador (acceso total) |
| `senior_commercial` | Comercial Senior |
| `sdr` | SDR / Outbound |
| `reviewer` | Revisor (solo lectura global) |
| `functional_consultant` | Consultor Funcional |
| `external_partner` | Partner Externo |

Cada rol tiene un set de permisos del tipo `resource:action` (por ejemplo `contacts:read:all`, `opportunities:change_stage`). Ver `prisma/seed.ts` para el detalle completo.

## Scripts útiles

| Script | Descripción |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Build de producción |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:seed` | Seed de roles, permisos y admin |
| `pnpm db:studio` | Prisma Studio |

## Roadmap

- **Fase 1 (actual):** fundación — auth, RBAC, layout, audit log, schema base.
- **Fase 2:** módulo de Contactos (CRUD + import/export CSV, ownership, duplicados).
- **Fase 3:** módulo de Cuentas + Oportunidades con stages configurables.
- **Fase 4:** Pipeline Kanban, forecast ponderado, actividades y recordatorios.
- **Fase 5:** Reportes y dashboards, exports, notificaciones por email (Resend).
