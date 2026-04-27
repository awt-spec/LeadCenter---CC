import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { getCampaignById } from '@/lib/campaigns/queries';
import { CampaignForm } from '../../components/campaign-form';

export const metadata = { title: 'Editar campaña' };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!hasRole(session, 'admin') && !hasRole(session, 'senior_commercial')) {
    return <Forbidden message="No tienes permiso para editar campañas." />;
  }

  const campaign = await getCampaignById(session, id);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver
      </Link>
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Editar campaña</h2>
        <p className="mt-1 text-sm text-sysde-mid">{campaign.name}</p>
      </div>
      <CampaignForm
        campaignId={campaign.id}
        initial={{
          name: campaign.name,
          code: campaign.code ?? '',
          description: campaign.description ?? '',
          type: campaign.type,
          status: campaign.status,
          goal: campaign.goal,
          targetSegment: campaign.targetSegment,
          targetCountry: campaign.targetCountry ?? '',
          startDate: campaign.startDate ? campaign.startDate.toISOString().slice(0, 10) : '',
          endDate: campaign.endDate ? campaign.endDate.toISOString().slice(0, 10) : '',
          budget: campaign.budget ? Number(campaign.budget) : null,
          spent: campaign.spent ? Number(campaign.spent) : null,
          currency: campaign.currency,
          ownerId: campaign.ownerId,
        }}
      />
    </div>
  );
}
