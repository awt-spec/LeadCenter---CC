'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface TaskDetail {
  id: string;
  title: string;
  // ... el shape completo viene del endpoint, lo dejamos como unknown
  // y el consumer hace cast porque el shape ya está tipado en el drawer.
  [k: string]: unknown;
}

export function useTaskById(taskId: string | null) {
  return useQuery<TaskDetail | null>({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch task');
      const data = (await res.json()) as { task?: TaskDetail };
      return data.task ?? null;
    },
    enabled: !!taskId,
    staleTime: 30_000,
  });
}

/// Hook auxiliar para invalidar el cache de un task después de mutar.
export function useInvalidateTask() {
  const qc = useQueryClient();
  return (taskId: string) => qc.invalidateQueries({ queryKey: ['task', taskId] });
}
