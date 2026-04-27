import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { CampaignForm } from '../components/campaign-form';

export const metadata = { title: 'Nueva campaña' };

export default async function NewCampaignPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!hasRole(session, 'admin') && !hasRole(session, 'senior_commercial')) {
    return <Forbidden message="No tienes permiso para crear campañas." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Campañas
      </Link>
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Nueva campaña</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Crea una campaña, define el flujo y enrola contactos.
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
