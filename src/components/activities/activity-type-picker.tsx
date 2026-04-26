'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TEMPLATE_LIST } from '@/lib/activities/templates';
import { cn } from '@/lib/utils';

type Props = {
  onPick: (templateKey: string | 'free') => void;
};

export function ActivityTypePicker({ onPick }: Props) {
  const [q, setQ] = useState('');
  const filtered = TEMPLATE_LIST.filter((t) =>
    t.name.toLowerCase().includes(q.toLowerCase()) ||
    t.description.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar plantilla…"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((tpl) => {
          const Icon = tpl.icon;
          return (
            <button
              key={tpl.key}
              type="button"
              onClick={() => onPick(tpl.key)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-xl border border-sysde-border bg-white p-4 text-left transition-all',
                'hover:-translate-y-px hover:border-sysde-red/40 hover:shadow-sm'
              )}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: tpl.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-sysde-gray">{tpl.name}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-sysde-mid">{tpl.description}</div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPick('free')}
          className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-sysde-border bg-white p-4 text-left transition-all hover:-translate-y-px hover:border-sysde-red/40"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sysde-bg text-sysde-mid">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-sysde-gray">Actividad libre</div>
            <div className="mt-0.5 text-xs text-sysde-mid">Formato flexible sin plantilla</div>
          </div>
        </button>
      </div>
    </div>
  );
}
