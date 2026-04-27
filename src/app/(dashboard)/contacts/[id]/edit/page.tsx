import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getContactById, listTags, listUsers } from '@/lib/contacts/queries';
import { prisma } from '@/lib/db';
import { Forbidden } from '@/components/shared/forbidden';
import { ContactForm } from '../../components/contact-form';

export const metadata = { title: 'Editar contacto' };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const contact = await getContactById(session, id);
  if (!contact) notFound();

  const isOwn = contact.ownerId === session.user.id;
  const hasAll = can(session, 'contacts:update:all');
  const hasOwn = can(session, 'contacts:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return <Forbidden message="No tienes permiso para editar este contacto." />;
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
          href={`/contacts/${id}`}
          className="inline-flex items-center gap-1 text-sm text-sysde-mid transition-colors hover:text-sysde-gray"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a {contact.fullName}
        </Link>
        <h2 className="mt-2 text-[24px] font-semibold text-sysde-gray">
          Editar contacto
        </h2>
      </div>

      <ContactForm
        mode="edit"
        contactId={id}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        tags={tags}
        accounts={accounts}
        canDelete={can(session, 'contacts:delete')}
        defaults={{
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          jobTitle: contact.jobTitle ?? '',
          department: contact.department ?? '',
          seniorityLevel: contact.seniorityLevel,
          companyName: contact.companyName ?? '',
          accountId: contact.accountId,
          country: contact.country ?? '',
          city: contact.city ?? '',
          timezone: contact.timezone ?? '',
          phone: contact.phone ?? '',
          mobilePhone: contact.mobilePhone ?? '',
          linkedinUrl: contact.linkedinUrl ?? '',
          website: contact.website ?? '',
          source: contact.source,
          sourceDetail: contact.sourceDetail ?? '',
          status: contact.status,
          ownerId: contact.ownerId,
          marketSegment: contact.marketSegment,
          productInterest: contact.productInterest,
          optIn: contact.optIn,
          doNotContact: contact.doNotContact,
          notes: contact.notes ?? '',
          tagIds: contact.tags.map((t) => t.tagId),
        }}
      />
    </div>
  );
}
