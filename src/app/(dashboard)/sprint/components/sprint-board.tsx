import Link from 'next/link';
import { ChevronRight, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { SprintBoard, SprintCard } from '@/lib/sprint/queries';

const ACCENT_BG: Record<SprintCard['accent'], string> = {
  red: 'border-l-red-500',
  orange: 'border-l-orange-500',
  amber: 'border-l-amber-500',
  emerald: 'border-l-emerald-500',
  neutral: 'border-l-neutral-300',
  'red-sysde': 'border-l-sysde-red',
};

export function SprintBoardView({ board }: { board: SprintBoard }) {
  return (
    <div className="space-y-6">
      {/* Goals */}
      {board.goals.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sysde-mid">
            <Target className="h-3.5 w-3.5 text-sysde-red" />
            Objetivos del sprint
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {board.goals.map((g) => {
              const pct = g.target === 0 ? (g.current === 0 ? 100 : 0) : Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <div key={g.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-sysde-gray">{g.label}</span>
                    <span className="font-display text-lg font-bold tabular-nums text-sysde-gray">
                      {g.current}<span className="text-xs font-normal text-sysde-mid">/{g.target}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className={`h-full transition-[width] ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sysde-red' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Board */}
      <div className="grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {board.buckets.map((b) => (
          <div key={b.key} className="flex flex-col rounded-lg border border-sysde-border bg-sysde-bg/30">
            <div className="border-b border-sysde-border bg-white px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sysde-gray">
                  {b.label}
                </h3>
                <span className="rounded-full bg-sysde-bg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sysde-mid">
                  {b.cards.length}
                </span>
              </div>
              {b.description && (
                <p className="mt-0.5 text-[10px] text-sysde-mid">{b.description}</p>
              )}
            </div>
            <div className="flex-1 space-y-2 p-2">
              {b.cards.length === 0 ? (
                <div className="grid h-20 place-items-center rounded-md border border-dashed border-sysde-border/60 text-[11px] text-sysde-mid">
                  vacío
                </div>
              ) : (
                b.cards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className={`group block rounded-md border border-l-4 ${ACCENT_BG[card.accent]} border-y-sysde-border border-r-sysde-border bg-white p-2.5 transition hover:border-sysde-red/40 hover:shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-sysde-gray group-hover:text-sysde-red">
                          {card.title}
                        </p>
                        {card.subtitle && (
                          <p className="mt-0.5 truncate text-[11px] text-sysde-mid">{card.subtitle}</p>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sysde-mid opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    {card.meta.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {card.meta.map((m) => (
                          <span key={m.label} className="inline-flex items-center gap-1 rounded bg-sysde-bg/60 px-1.5 py-0.5 text-[10px] text-sysde-mid">
                            <span className="font-medium text-sysde-gray">{m.label}:</span>
                            <span className="truncate max-w-[140px]">{m.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
