'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/// QueryClient + Provider para los hooks `useQuery`/`useMutation`.
/// Vivirá en el layout del dashboard. Defaults conservadores:
///   - staleTime 30s — los datos se consideran frescos por 30 seg después
///     de fetch. Re-renders no disparan refetch.
///   - gcTime 5 min — datos se mantienen en cache 5 min después de
///     unmount, así navegación back/forward sirve del cache.
///   - retry 1 — un solo retry en errores de red transientes.
///   - refetchOnWindowFocus false — evitamos refetch agresivo al volver
///     a la pestaña (cambia el comportamiento default que era true).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
