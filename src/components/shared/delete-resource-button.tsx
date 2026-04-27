'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type DeleteAction = (id: string) => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>;

export function DeleteResourceButton({
  id,
  resourceLabel,
  resourceName,
  action,
  redirectTo = '/',
  variant = 'outline',
  size = 'default',
  className,
}: {
  id: string;
  resourceLabel: string;
  resourceName?: string;
  action: DeleteAction;
  redirectTo?: string;
  variant?: 'outline' | 'destructive' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const r = await action(id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${resourceLabel} eliminado`);
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Trash2 className={size === 'icon' ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
          {size !== 'icon' && 'Eliminar'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <AlertDialogTitle>Eliminar {resourceLabel.toLowerCase()}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {resourceName ? (
                  <>
                    Vas a eliminar <strong>{resourceName}</strong>. Esta acción no se puede
                    deshacer.
                  </>
                ) : (
                  'Esta acción no se puede deshacer.'
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {pending ? 'Eliminando…' : 'Sí, eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
