export const TASK_STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  REVIEW: 'En revisión',
  BLOCKED: 'Bloqueada',
  DONE: 'Completada',
  CANCELLED: 'Cancelada',
};

export const TASK_STATUS_STYLE: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-700 ring-slate-200',
  TODO: 'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-amber-200',
  REVIEW: 'bg-violet-50 text-violet-700 ring-violet-200',
  BLOCKED: 'bg-red-50 text-red-700 ring-red-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-neutral-100 text-neutral-500 ring-neutral-200',
};

export const TASK_STATUS_DOT: Record<string, string> = {
  BACKLOG: 'bg-slate-400',
  TODO: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  REVIEW: 'bg-violet-500',
  BLOCKED: 'bg-red-600',
  DONE: 'bg-emerald-500',
  CANCELLED: 'bg-neutral-400',
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const TASK_PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-200',
  NORMAL: 'bg-blue-50 text-blue-700 ring-blue-200',
  HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
  URGENT: 'bg-red-50 text-red-700 ring-red-200',
};

export const TASK_PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-400',
  NORMAL: 'bg-blue-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-red-600',
};

// Order for kanban columns
export const KANBAN_COLUMNS: Array<{ status: string; label: string }> = [
  { status: 'BACKLOG', label: 'Backlog' },
  { status: 'TODO', label: 'Por hacer' },
  { status: 'IN_PROGRESS', label: 'En progreso' },
  { status: 'REVIEW', label: 'En revisión' },
  { status: 'BLOCKED', label: 'Bloqueadas' },
  { status: 'DONE', label: 'Completadas' },
];

// Curated palette for color-coding tasks. Hex values match Tailwind 500-shade
// for visual consistency with the rest of the design system.
export const TASK_COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: '#C8200F', label: 'SYSDE rojo' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#F59E0B', label: 'Ámbar' },
  { value: '#EAB308', label: 'Amarillo' },
  { value: '#10B981', label: 'Verde' },
  { value: '#06B6D4', label: 'Cian' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#64748B', label: 'Pizarra' },
];

// Status pill color (background + text + ring) — used in list / detail views
// for a richer chip than the dot-only kanban header.
export const TASK_STATUS_PILL: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  TODO: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  REVIEW: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
  BLOCKED: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  DONE: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  CANCELLED: 'bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200',
};

export const TASK_PRIORITY_PILL: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',
  NORMAL: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  HIGH: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  URGENT: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};
