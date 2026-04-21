import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/contacts/queries';
import { Forbidden } from '@/components/shared/forbidden';
import { OpportunityForm } from '../components/opportunity-form';

export const metadata = { title: 'Nueva oportunidad' };

type SearchParams = Promise<{ accountId?: string }>;

export default async function NewOpportunityPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'opportunities:create')) {
    return <Forbidden message="No tienes permiso para crear oportunidades." />;
  }

  const [users, accounts, contacts] = await Promise.all([
    listUsers(),
    prisma.account.findMany({
      select: { id: true, name: true, country: true },
      orderBy: { name: 'asc' },
    }),
    prisma.contact.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <div>
      <Link href="/opportunities" className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray">
        <ChevronLeft className="h-4 w-4" />
        Oportunidades
      </Link>
      <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">Nueva oportunidad</h2>

      <div className="mt-6">
        <OpportunityForm
          mode="create"
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          accounts={accounts}
          contacts={contacts}
          defaults={{
            ownerId: session.user.id,
            accountId: sp.accountId,
          }}
        />
      </div>
    </div>
  );
}
