'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Building2, Users, ArrowUpRight } from 'lucide-react';
import { classifyContactHealth, HEALTH_BG, HEALTH_LABELS } from '@/lib/contacts/health';
import type { ContactStatus, SeniorityLevel } from '@prisma/client';
import { cn } from '@/lib/utils';

interface Group {
  accountId: string;
  accountName: string;
  accountCountry: string | null;
  accountSegment: string | null;
  totalContacts: number;
  contacts: Array<{
    id: string;
    fullName: string;
    email: string;
    jobTitle: string | null;
    seniorityLevel: string | null;
    status: string;
    country: string | null;
    engagementScore: number;
  }>;
}

const SENIORITY_LABELS: Record<string, string> = {
  UNKNOWN: '—',
  ANALYST: 'Analista',
  MANAGER: 'Gerente',
  DIRECTOR: 'Director',
  VP: 'VP',
  C_LEVEL: 'C-Level',
  OWNER: 'Owner',
};

export function ContactsByAccountView({
  groups,
  totalAccounts,
  unassignedTotal,
}: {
  groups: Group[];
  totalAccounts: number;
  unassignedTotal: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(groups.slice(0, 3).map((g) => g.accountId)));

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-sysde-border bg-white p-10 text-center text-sm text-sysde-mid">
        Sin cuentas con contactos en este filtro.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-sysde-mid">
        {totalAccounts} cuentas con contactos · {unassignedTotal > 0 && (
          <Link href="/contacts?ownerId=" className="text-sysde-red hover:underline">
            {unassignedTotal} contactos sin cuenta
          </Link>
        )}
      </p>
      {groups.map((g) => {
        const isExpanded = expanded.has(g.accountId);
        const healthCounts = g.contacts.reduce(
          (acc, c) => {
            const h = classifyContactHealth({
              email: c.email,
              status: c.status as ContactStatus,
              seniorityLevel: c.seniorityLevel as SeniorityLevel | null,
            });
            acc[h]++;
            return acc;
          },
          { red: 0, yellow: 0, green: 0 }
        );
        return (
          <div key={g.accountId} className="overflow-hidden rounded-md border border-sysde-border bg-white">
            <button
              type="button"
              onClick={() => {
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.accountId)) next.delete(g.accountId);
                  else next.add(g.accountId);
                  return next;
                });
              }}
              className="flex w-full items-center gap-3 border-b border-sysde-border bg-sysde-bg/30 px-4 py-3 text-left transition hover:bg-sysde-bg/60"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-sysde-mid" /> : <ChevronRight className="h-4 w-4 text-sysde-mid" />}
              <Building2 className="h-4 w-4 shrink-0 text-sysde-red" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sysde-gray truncate">{g.accountName}</p>
                <p className="text-[11px] text-sysde-mid">
                  {[g.accountCountry, g.accountSegment].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {/* Health summary chips */}
                <div className="flex items-center gap-1.5">
                  {healthCounts.green > 0 && (
                    <span className="inline-flex items-center gap-1" title={HEALTH_LABELS.green}>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-semibold tabular-nums text-emerald-700">{healthCounts.green}</span>
                    </span>
                  )}
                  {healthCounts.yellow > 0 && (
                    <span className="inline-flex items-center gap-1" title={HEALTH_LABELS.yellow}>
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="font-semibold tabular-nums text-amber-700">{healthCounts.yellow}</span>
                    </span>
                  )}
                  {healthCounts.red > 0 && (
                    <span className="inline-flex items-center gap-1" title={HEALTH_LABELS.red}>
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="font-semibold tabular-nums text-red-700">{healthCounts.red}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sysde-mid">
                  <Users className="h-3 w-3" />
                  <span className="font-semibold tabular-nums">{g.totalContacts}</span>
                </div>
                <Link
                  href={`/accounts/${g.accountId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1 inline-flex items-center gap-0.5 rounded-md border border-sysde-border bg-white px-2 py-0.5 text-[11px] text-sysde-mid hover:border-sysde-red hover:text-sysde-red"
                >
                  Ver cuenta <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </button>

            {isExpanded && (
              <div className="divide-y divide-sysde-border">
                {g.contacts.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-sysde-mid">Sin contactos en este filtro.</div>
                ) : (
                  g.contacts.map((c) => {
                    const h = classifyContactHealth({
                      email: c.email,
                      status: c.status as ContactStatus,
                      seniorityLevel: c.seniorityLevel as SeniorityLevel | null,
                    });
                    return (
                      <Link
                        key={c.id}
                        href={`/contacts/${c.id}`}
                        className="grid grid-cols-[16px_1fr_140px_100px_60px] items-center gap-3 px-4 py-2 text-sm transition hover:bg-sysde-bg/40"
                      >
                        <span className={cn('h-2 w-2 rounded-full', HEALTH_BG[h])} title={HEALTH_LABELS[h]} />
                        <div className="min-w-0">
                          <p className="font-medium text-sysde-gray truncate">{c.fullName}</p>
                          <p className="text-[11px] text-sysde-mid truncate">{c.email}</p>
                        </div>
                        <span className="text-xs text-sysde-mid truncate">{c.jobTitle ?? '—'}</span>
                        <span className="text-[11px] text-sysde-mid">{c.seniorityLevel ? SENIORITY_LABELS[c.seniorityLevel] ?? c.seniorityLevel : '—'}</span>
                        <span className="text-right text-[11px] tabular-nums text-sysde-mid">{c.engagementScore}</span>
                      </Link>
                    );
                  })
                )}
                {g.totalContacts > g.contacts.length && (
                  <Link
                    href={`/contacts?accountId=${g.accountId}`}
                    className="block bg-sysde-bg/40 px-4 py-2 text-center text-[11px] font-medium text-sysde-red hover:underline"
                  >
                    Ver los {g.totalContacts - g.contacts.length} contactos restantes →
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
