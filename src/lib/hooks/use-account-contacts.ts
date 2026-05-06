'use client';

import { useQuery } from '@tanstack/react-query';

export interface AccountContactLite {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  seniorityLevel: string | null;
  status: string;
}

/// Cached fetch de contactos de una cuenta. Reemplaza el fetch manual
/// con cache local que el activity composer usaba (`accountContactsCache`).
/// Múltiples componentes que monten el mismo accountId comparten el cache.
export function useAccountContacts(accountId: string | null | undefined) {
  return useQuery<AccountContactLite[]>({
    queryKey: ['account-contacts', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const res = await fetch(`/api/accounts/${accountId}/contacts-mini`);
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const data = (await res.json()) as { contacts?: AccountContactLite[] };
      return data.contacts ?? [];
    },
    enabled: !!accountId,
    // Los contactos de una cuenta cambian poco mid-session.
    staleTime: 60_000,
  });
}
