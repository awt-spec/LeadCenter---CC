// Demo user shortcut — entra sin tocar la base de datos.
// Útil cuando la app aún no tiene credenciales reales de Supabase configuradas
// o para mostrar la app sin depender del estado de la DB.

export const DEMO_USER_ID = 'demo-user';
export const DEMO_EMAIL = 'demo@sysde.com';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_NAME = 'Demo';

// Todos los permission keys del sistema (debe seguir el catálogo de seed.ts).
// El demo user recibe estos permisos via JWT sin pasar por la tabla rolePermission.
export const DEMO_PERMISSIONS = [
  // Contacts
  'contacts:read:all',
  'contacts:read:own',
  'contacts:create',
  'contacts:update:all',
  'contacts:update:own',
  'contacts:delete',
  'contacts:import_csv',
  'contacts:export_csv',
  // Accounts
  'accounts:read:all',
  'accounts:read:own',
  'accounts:create',
  'accounts:update:all',
  'accounts:update:own',
  'accounts:delete',
  // Opportunities
  'opportunities:read:all',
  'opportunities:read:own',
  'opportunities:create',
  'opportunities:update:all',
  'opportunities:update:own',
  'opportunities:delete',
  'opportunities:change_stage',
  // Activities
  'activities:read',
  'activities:create',
  'activities:update:own',
  'activities:delete:own',
  // Reports
  'reports:read:all',
  'reports:read:own',
  'reports:create',
  'reports:export',
  // Users
  'users:read',
  'users:invite',
  'users:update',
  'users:deactivate',
  // Settings
  'settings:read',
  'settings:update',
  // Audit
  'audit:read',
];

export const DEMO_ROLES = ['admin'];

// The demo bypass is OFF in production unless DEMO_MODE=true is set
// in env. This protects real deployments from a well-known credential
// path being usable forever, while still letting us run public demos.
export function isDemoEnabled(): boolean {
  if (process.env.DEMO_MODE === 'true') return true;
  if (process.env.DEMO_MODE === 'false') return false;
  // Default: enabled outside production
  return process.env.NODE_ENV !== 'production';
}

export function isDemoCredentials(email: string, password: string): boolean {
  if (!isDemoEnabled()) return false;
  return email === DEMO_EMAIL && password === DEMO_PASSWORD;
}
