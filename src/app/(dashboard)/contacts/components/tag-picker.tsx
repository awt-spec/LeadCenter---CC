'use client';

import { useState } from 'react';
import { Check, Tag as TagIcon, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tag = { id: string; name: string; color: string };

type Props = {
  tags: Tag[];
  value: string[];
  onChange: (next: string[]) => void;
};

export function TagPicker({ tags, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const selected = tags.filter((t) => value.includes(t.id));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selected.length === 0 && (
          <span className="text-sm text-sysde-mid">Sin tags asignados</span>
        )}
        {selected.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: t.color }}
          >
            {t.name}
            <button
              type="button"
              onClick={() => toggle(t.id)}
              className="opacity-70 hover:opacity-100"
              aria-label={`Quitar tag ${t.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <TagIcon className="mr-1.5 h-4 w-4" />
            Gestionar tags
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Buscar tag…" />
            <CommandList>
              <CommandEmpty>No hay tags.</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const isActive = value.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => toggle(tag.id)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      <Check
                        className={cn(
                          'h-4 w-4 text-sysde-red',
                          isActive ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
