'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  Briefcase,
  User as UserIcon,
  Megaphone,
  LayoutDashboard,
  Users,
  Kanban,
  Activity as ActivityIcon,
  BarChart3,
  Inbox,
  Settings,
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type SearchResult = {
  contacts: { id: string; fullName: string; email: string; companyName: string | null }[];
  accounts: { id: string; name: string; domain: string | null; country: string | null }[];
  opportunities: {
    id: string;
    name: string;
    code: string | null;
    stage: string;
    account: { id: string; name: string };
  }[];
  campaigns: { id: string; name: string; code: string | null; type: string; status: string }[];
};

const NAV_ITEMS: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; keywords?: string }[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'Base de datos', href: '/contacts', icon: Users, keywords: 'contactos' },
  { label: 'Cuentas', href: '/accounts', icon: Building2, keywords: 'empresas' },
  { label: 'Oportunidades', href: '/opportunities', icon: Briefcase, keywords: 'opps deals' },
  { label: 'Pipeline', href: '/pipeline', icon: Kanban, keywords: 'kanban' },
  { label: 'Campañas', href: '/campaigns', icon: Megaphone },
  { label: 'Actividad', href: '/activities', icon: ActivityIcon },
  { label: 'Reportes', href: '/reports', icon: BarChart3, keywords: 'analytics' },
  { label: 'Ajustes', href: '/settings/users', icon: Settings, keywords: 'settings users' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult>({
    contacts: [],
    accounts: [],
    opportunities: [],
    campaigns: [],
  });
  const [loading, setLoading] = useState(false);

  // Cmd+K (or Ctrl+K) to toggle
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults({ contacts: [], accounts: [], opportunities: [], campaigns: [] });
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (r.ok) {
          const data = await r.json();
          setResults(data);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    router.push(href);
  }

  const hasResults =
    results.contacts.length > 0 ||
    results.accounts.length > 0 ||
    results.opportunities.length > 0 ||
    results.campaigns.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <Command shouldFilter={false}>
          <CommandInput
        placeholder="Buscar contactos, cuentas, oportunidades, campañas… (Cmd+K)"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>
          {loading
            ? 'Buscando…'
            : q.trim().length < 2
            ? 'Escribe al menos 2 caracteres'
            : 'Sin resultados'}
        </CommandEmpty>

        {q.trim().length < 2 && (
          <CommandGroup heading="Ir a">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.keywords ?? ''}`}
                  onSelect={() => go(item.href)}
                >
                  <Icon className="mr-2 h-4 w-4 text-sysde-mid" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {results.contacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contactos">
              {results.contacts.map((c) => (
                <CommandItem key={c.id} value={`c-${c.id} ${c.fullName} ${c.email}`} onSelect={() => go(`/contacts/${c.id}`)}>
                  <UserIcon className="mr-2 h-4 w-4 text-sysde-mid" />
                  <span className="flex-1 truncate">{c.fullName}</span>
                  <span className="ml-2 truncate text-xs text-sysde-mid">{c.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cuentas">
              {results.accounts.map((a) => (
                <CommandItem key={a.id} value={`a-${a.id} ${a.name}`} onSelect={() => go(`/accounts/${a.id}`)}>
                  <Building2 className="mr-2 h-4 w-4 text-sysde-mid" />
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.country && (
                    <span className="ml-2 truncate text-xs text-sysde-mid">{a.country}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.opportunities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Oportunidades">
              {results.opportunities.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`o-${o.id} ${o.name} ${o.code ?? ''} ${o.account.name}`}
                  onSelect={() => go(`/opportunities/${o.id}`)}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-sysde-mid" />
                  <span className="flex-1 truncate">{o.name}</span>
                  <span className="ml-2 truncate text-xs text-sysde-mid">
                    {o.account.name} · {o.stage}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.campaigns.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Campañas">
              {results.campaigns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`cmp-${c.id} ${c.name} ${c.code ?? ''}`}
                  onSelect={() => go(`/campaigns/${c.id}`)}
                >
                  <Megaphone className="mr-2 h-4 w-4 text-sysde-mid" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="ml-2 truncate text-xs text-sysde-mid">{c.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
