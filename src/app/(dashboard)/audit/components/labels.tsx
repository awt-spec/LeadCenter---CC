// Mapas de label hispanizados para acciones y recursos del log de
// auditoría. Cualquier valor no listado se muestra raw.

export const ACTION_LABEL: Record<string, string> = {
  login: 'Inicio sesión',
  logout: 'Cierre sesión',
  create: 'Creación',
  update: 'Actualización',
  delete: 'Borrado',
  archive: 'Archivado',
  restore: 'Restauración',
  import: 'Importación',
  export: 'Exportación',
  assign: 'Asignación',
  unassign: 'Desasignación',
  comment: 'Comentario',
  attach: 'Adjunto',
  send: 'Envío',
  status_change: 'Cambio de estado',
  stage_change: 'Cambio de etapa',
  permission_change: 'Cambio de permiso',
  role_change: 'Cambio de rol',
};

export const RESOURCE_LABEL: Record<string, string> = {
  auth: 'Autenticación',
  accounts: 'Cuentas',
  contacts: 'Contactos',
  opportunities: 'Oportunidades',
  tasks: 'Tareas',
  activities: 'Actividades',
  campaigns: 'Campañas',
  custom_fields: 'Campos personalizados',
  roles: 'Roles',
  users: 'Usuarios',
  integrations: 'Integraciones',
  attachments: 'Adjuntos',
  assignees: 'Asignaciones',
};

export const ACTION_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'danger' | 'secondary' | 'outline'
> = {
  create: 'success',
  import: 'success',
  login: 'success',
  update: 'default',
  status_change: 'default',
  stage_change: 'default',
  delete: 'danger',
  archive: 'warning',
  logout: 'secondary',
  permission_change: 'warning',
  role_change: 'warning',
};
