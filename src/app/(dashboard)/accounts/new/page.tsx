import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/contacts/queries';
import { Forbidden } from '@/components/shared/forbidden';
import { AccountForm } from '../components/account-form';

export const metadata = { title: 'Nueva cuenta' };

export default async function NewAccountPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!can(session, 'accounts:create')) {
    return <Forbidden message="No tienes permiso para crear cuentas." />;
  }

  const [users, accounts] = await Promise.all([
    listUsers(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray">
        <ChevronLeft className="h-4 w-4" />
        Cuentas
      </Link>
      <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">Nueva cuenta</h2>

      <div className="mt-6">
        <AccountForm
          mode="create"
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          accounts={accounts}
          defaults={{ ownerId: session.user.id }}
        />
      </div>
    </div>
  );
}
