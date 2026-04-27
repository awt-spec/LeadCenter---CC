'use client';

import { useRouter } from 'next/navigation';
import { TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={cn('cursor-pointer transition-colors hover:bg-sysde-bg', className)}
      onClick={() => router.push(href)}
    >
      {children}
    </TableRow>
  );
}
