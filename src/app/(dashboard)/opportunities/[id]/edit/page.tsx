import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/contacts/queries';
import { getOpportunityById } from '@/lib/opportunities/queries';
import { Forbidden } from '@/components/shared/forbidden';
import { OpportunityForm } from '../../components/opportunity-form';

export const metadata = { title: 'Editar oportunidad' };

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const opp = await getOpportunityById(session, id);
  if (!opp) notFound();

  const isOwn = opp.ownerId === session.user.id;
  const hasAll = can(session, 'opportunities:update:all');
  const hasOwn = can(session, 'opportunities:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return <Forbidden message="No tienes permiso para editar esta oportunidad." />;
  }

  const [users, accounts, contacts] = await Promise.all([
    listUsers(),
    prisma.account.findMany({ select: { id: true, name: true, country: true }, orderBy: { name: 'asc' } }),
    prisma.contact.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' }, take: 200 }),
  ]);

  return (
    <div>
      <Link href={`/opportunities/${id}`} className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray">
        <ChevronLeft className="h-4 w-4" />
        {opp.name}
      </Link>
      <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">Editar oportunidad</h2>

      <div className="mt-6">
        <OpportunityForm
          mode="edit"
          opportunityId={id}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          accounts={accounts}
          contacts={contacts}
          canDelete={can(session, 'opportunities:delete')}
          defaults={{
            name: opp.name,
            code: opp.code ?? '',
            accountId: opp.accountId,
            product: opp.product,
            subProduct: opp.subProduct,
            stage: opp.stage,
            status: opp.status,
            rating: opp.rating,
            probability: opp.probability,
            estimatedValue: opp.estimatedValue ? Number(opp.estimatedValue) : null,
            currency: opp.currency,
            commercialModel: opp.commercialModel,
            portfolioAmount: opp.portfolioAmount ? Number(opp.portfolioAmount) : null,
            userCount: opp.userCount,
            annualOperations: opp.annualOperations,
            clientCount: opp.clientCount,
            officeCount: opp.officeCount,
            expectedCloseDate: opp.expectedCloseDate,
            nextActionDate: opp.nextActionDate,
            nextActionNote: opp.nextActionNote ?? '',
            source: opp.source,
            sourceDetail: opp.sourceDetail ?? '',
            isDirectProspecting: opp.isDirectProspecting,
            referredById: opp.referredById,
            ownerId: opp.ownerId,
            description: opp.description ?? '',
            internalNotes: opp.internalNotes ?? '',
          }}
        />
      </div>
    </div>
  );
}
