'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

type Item = { id: string; name: string; email: string; avatarUrl: string | null };

export type MentionListRef = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

type Props = SuggestionProps<Item>;

export const MentionList = forwardRef<MentionListRef, Props>(function MentionList(
  props,
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = (idx: number) => {
    const item = props.items[idx];
    if (!item) return;
    props.command({ id: item.id, label: item.name } as never);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="rounded-xl border border-sysde-border bg-white p-3 text-xs text-sysde-mid shadow-md">
        Sin resultados
      </div>
    );
  }

  return (
    <div className="max-h-64 w-64 overflow-y-auto rounded-xl border border-sysde-border bg-white p-1 shadow-md">
      {props.items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => selectItem(i)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            i === selectedIndex ? 'bg-sysde-red-light' : 'hover:bg-sysde-bg'
          )}
        >
          <Avatar className="h-6 w-6">
            {item.avatarUrl ? <AvatarImage src={item.avatarUrl} alt={item.name} /> : null}
            <AvatarFallback className="text-[10px]">{getInitials(item.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sysde-gray">{item.name}</div>
            <div className="truncate text-xs text-sysde-mid">{item.email}</div>
          </div>
        </button>
      ))}
    </div>
  );
});
