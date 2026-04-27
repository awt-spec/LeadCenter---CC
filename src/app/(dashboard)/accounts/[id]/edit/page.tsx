import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/contacts/queries';
import { getAccountById } from '@/lib/accounts/queries';
import { Forbidden } from '@/components/shared/forbidden';
import { AccountForm } from '../../components/account-form';

export const metadata = { title: 'Editar cuenta' };

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await getAccountById(session, id);
  if (!account) notFound();

  const isOwn = account.ownerId === session.user.id;
  const hasAll = can(session, 'accounts:update:all');
  const hasOwn = can(session, 'accounts:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return <Forbidden message="No tienes permiso para editar esta cuenta." />;
  }

  const [users, accounts] = await Promise.all([
    listUsers(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <Link href={`/accounts/${id}`} className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray">
        <ChevronLeft className="h-4 w-4" />
        {account.name}
      </Link>
      <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">Editar cuenta</h2>

      <div className="mt-6">
        <AccountForm
          mode="edit"
          accountId={id}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          accounts={accounts}
          canDelete={can(session, 'accounts:delete')}
          defaults={{
            name: account.name,
            legalName: account.legalName ?? '',
            domain: account.domain ?? '',
            website: account.website ?? '',
            segment: account.segment,
            industry: account.industry ?? '',
            subIndustry: account.subIndustry ?? '',
            size: account.size,
            country: account.country ?? '',
            region: account.region ?? '',
            city: account.city ?? '',
            address: account.address ?? '',
            status: account.status,
            ownerId: account.ownerId,
            parentAccountId: account.parentAccountId,
            description: account.description ?? '',
            internalNotes: account.internalNotes ?? '',
          }}
        />
      </div>
    </div>
  );
}
