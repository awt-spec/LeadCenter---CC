import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { listTags, listUsers } from '@/lib/contacts/queries';
import { Forbidden } from '@/components/shared/forbidden';
import { ImportWizard } from '../components/import-wizard';

export const metadata = { title: 'Importar contactos' };

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'contacts:import_csv')) {
    return <Forbidden message="No tienes permiso para importar contactos." />;
  }

  const [users, tags] = await Promise.all([listUsers(), listTags()]);

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-sysde-mid transition-colors hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Contactos
      </Link>
      <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">Importar contactos desde CSV</h2>
      <p className="mt-1 text-sm text-sysde-mid">
        Sube un CSV, mapea las columnas y define cómo manejar duplicados.
      </p>

      <div className="mt-6">
        <ImportWizard
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          tags={tags}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
