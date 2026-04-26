'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Star, Trash2 } from 'lucide-react';
import type { ContactRole } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  linkContactToOpportunity,
  unlinkContactFromOpportunity,
} from '@/lib/opportunities/mutations';
import {
  CONTACT_ROLE_LABELS,
  CONTACT_ROLE_COLORS,
} from '@/lib/shared/labels';
import { getInitials, cn } from '@/lib/utils';

type Role = {
  contactId: string;
  role: string;
  isPrimary: boolean;
  contact: {
    id: string;
    fullName: string;
    email: string;
    jobTitle: string | null;
    avatarUrl: string | null;
  };
};

type ContactOption = { id: string; fullName: string; email: string; jobTitle: string | null };

type Props = {
  opportunityId: string;
  roles: Role[];
  allContacts: ContactOption[];
  canEdit: boolean;
};

export function ContactRolesManager({ opportunityId, roles, allContacts, canEdit }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [role, setRole] = useState<ContactRole>('INFLUENCER');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!selectedContactId) return;
    setSubmitting(true);
    const res = await linkContactToOpportunity(opportunityId, {
      contactId: selectedContactId,
      role,
      isPrimary,
      notes: null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Contacto vinculado');
    setDialogOpen(false);
    setSelectedContactId('');
    setRole('INFLUENCER');
    setIsPrimary(false);
    router.refresh();
  }

  async function handleUnlink(contactId: string) {
    const res = await unlinkContactFromOpportunity(opportunityId, contactId);
    if (res.ok) {
      toast.success('Contacto desvinculado');
      router.refresh();
    } else toast.error(res.error);
  }

  const availableContacts = allContacts.filter((c) => !roles.some((r) => r.contactId === c.id));

  return (
    <div>
      <div className="flex items-center justify-between border-b border-sysde-border px-6 py-4">
        <div>
          <div className="text-sm font-semibold text-sysde-gray">
            Contactos vinculados ({roles.length})
          </div>
          <div className="text-xs text-sysde-mid">
            Asigna roles específicos para el ciclo de venta.
          </div>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Vincular contacto
          </Button>
        )}
      </div>

      <div className="divide-y divide-sysde-border">
        {roles.length === 0 ? (
          <div className="py-10 text-center text-sm text-sysde-mid">
            No hay contactos vinculados.
          </div>
        ) : (
          roles.map((r) => (
            <div key={r.contactId} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {r.contact.avatarUrl ? (
                    <AvatarImage src={r.contact.avatarUrl} alt={r.contact.fullName} />
                  ) : null}
                  <AvatarFallback className="text-xs">{getInitials(r.contact.fullName)}</AvatarFallback>
                </Avatar>
                <div>
                  <Link
                    href={`/contacts/${r.contact.id}`}
                    className="text-sm font-medium text-sysde-gray hover:text-sysde-red"
                  >
                    {r.contact.fullName}
                  </Link>
                  <div className="text-xs text-sysde-mid">
                    {[r.contact.jobTitle, r.contact.email].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {r.isPrimary && (
                  <span className="inline-flex items-center gap-1 text-xs text-warning">
                    <Star className="h-3.5 w-3.5 fill-warning" />
                    Primary
                  </span>
                )}
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                  style={{
                    backgroundColor:
                      CONTACT_ROLE_COLORS[r.role as keyof typeof CONTACT_ROLE_COLORS] ?? '#64748B',
                  }}
                >
                  {CONTACT_ROLE_LABELS[r.role as keyof typeof CONTACT_ROLE_LABELS] ?? r.role}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUnlink(r.contactId)}
                    aria-label="Desvincular"
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular contacto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Contacto</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger><SelectValue placeholder="Selecciona contacto" /></SelectTrigger>
                <SelectContent>
                  {availableContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName} — {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ContactRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_ROLE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(!!v)} />
              <span className="text-sm">Marcar como contacto primario</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={submitting || !selectedContactId}>
              {submitting ? 'Guardando…' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
