import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { listTags, listUsers } from '@/lib/contacts/queries';
import { prisma } from '@/lib/db';
import { Forbidden } from '@/components/shared/forbidden';
import { ContactForm } from '../components/contact-form';

export const metadata = { title: 'Nuevo contacto' };

export default async function NewContactPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'contacts:create')) {
    return <Forbidden message="No tienes permiso para crear contactos." />;
  }

  const [users, tags, accounts] = await Promise.all([
    listUsers(),
    listTags(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 500 }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1 text-sm text-sysde-mid transition-colors hover:text-sysde-gray"
        >
          <ChevronLeft className="h-4 w-4" />
          Contactos
        </Link>
        <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">Nuevo contacto</h2>
        <p className="mt-1 text-sm text-sysde-mid">Registra manualmente un nuevo contacto.</p>
      </div>

      <ContactForm
        mode="create"
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        tags={tags}
        accounts={accounts}
        defaults={{ ownerId: session.user.id }}
      />
    </div>
  );
}
