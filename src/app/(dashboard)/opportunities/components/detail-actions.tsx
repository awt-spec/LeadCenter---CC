'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, ArrowRight, Trash2 } from 'lucide-react';
import type { OpportunityStage } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StageChangeDialog } from './stage-change-dialog';
import { StageProgress } from './stage-progress';
import { deleteOpportunity } from '@/lib/opportunities/mutations';
import { toast } from 'sonner';

type Props = {
  opportunity: {
    id: string;
    stage: OpportunityStage;
    estimatedValue: number | null;
    portfolioAmount: number | null;
    userCount: number | null;
    annualOperations: number | null;
    commercialModel: string;
    expectedCloseDate: Date | null;
    hasContacts: boolean;
  };
  canChangeStage: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export function DetailActions({ opportunity, canChangeStage, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    const res = await deleteOpportunity(opportunity.id);
    if (res.ok) {
      toast.success('Oportunidad eliminada');
      router.push('/opportunities');
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canChangeStage && (
          <Button onClick={() => setStageDialogOpen(true)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Cambiar fase
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/opportunities/${opportunity.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        )}
        {(canDelete || canChangeStage) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Más">
                …
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canChangeStage && (
                <>
                  <DropdownMenuItem onSelect={() => setStageDialogOpen(true)}>
                    Marcar ganada / perdida / stand-by
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onSelect={(e) => { e.preventDefault(); setConfirmDelete(true); }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <StageChangeDialog
        opportunity={opportunity}
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar oportunidad?"
        description="Se eliminará junto con su historial. Esta acción no se puede deshacer."
        destructive
        confirmLabel="Sí, eliminar"
        onConfirm={handleDelete}
      />
    </>
  );
}

export function StageProgressWrapper({
  stage,
  onClickEnabled,
  onStageClicked,
}: {
  stage: OpportunityStage;
  onClickEnabled: boolean;
  onStageClicked?: (s: OpportunityStage) => void;
}) {
  return (
    <StageProgress
      currentStage={stage}
      onStageClick={onClickEnabled ? onStageClicked : undefined}
    />
  );
}
