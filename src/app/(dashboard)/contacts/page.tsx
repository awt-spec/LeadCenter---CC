import Link from 'next/link';
import { Upload, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  listContacts,
  listCountries,
  listTags,
  listUsers,
} from '@/lib/contacts/queries';
import { contactFilterSchema } from '@/lib/contacts/schemas';
import { ContactsFilters } from './components/contacts-filters';
import { ContactsTable, type ContactRow } from './components/contacts-table';
import { ExportButton } from './components/export-button';
import { Forbidden } from '@/components/shared/forbidden';

export const metadata = { title: 'Contactos' };

function parseArrayParam(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'contacts:read:all') && !can(session, 'contacts:read:own')) {
    return <Forbidden message="No tienes permiso para ver contactos." />;
  }

  const filters = contactFilterSchema.parse({
    q: typeof sp.q === 'string' ? sp.q : undefined,
    country: parseArrayParam(sp.country),
    status: parseArrayParam(sp.status),
    source: parseArrayParam(sp.source),
    ownerId: parseArrayParam(sp.ownerId),
    marketSegment: parseArrayParam(sp.marketSegment),
    productInterest: parseArrayParam(sp.productInterest),
    tagIds: parseArrayParam(sp.tagIds),
    createdFrom: typeof sp.createdFrom === 'string' ? sp.createdFrom : undefined,
    createdTo: typeof sp.createdTo === 'string' ? sp.createdTo : undefined,
    importBatchId: typeof sp.importBatchId === 'string' ? sp.importBatchId : undefined,
    page: sp.page ? Number(sp.page) : 1,
    pageSize: sp.pageSize ? Number(sp.pageSize) : 50,
    sortBy: typeof sp.sortBy === 'string' ? sp.sortBy : 'createdAt',
    sortDir: sp.sortDir === 'asc' ? 'asc' : 'desc',
  });

  const [{ rows, total }, countries, users, tags] = await Promise.all([
    listContacts(session, filters),
    listCountries(),
    listUsers(),
    listTags(),
  ]);

  const canCreate = can(session, 'contacts:create');
  const canImport = can(session, 'contacts:import_csv');
  const canExport = can(session, 'contacts:export_csv');
  const hasAnyFilter =
    !!filters.q ||
    !!filters.country?.length ||
    !!filters.status?.length ||
    !!filters.source?.length ||
    !!filters.ownerId?.length ||
    !!filters.marketSegment?.length ||
    !!filters.productInterest?.length ||
    !!filters.tagIds?.length;

  const tableRows: ContactRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    fullName: r.fullName,
    jobTitle: r.jobTitle,
    companyName: r.companyName,
    country: r.country,
    city: r.city,
    phone: r.phone,
    mobilePhone: r.mobilePhone,
    linkedinUrl: r.linkedinUrl,
    website: r.website,
    source: r.source,
    sourceDetail: r.sourceDetail,
    status: r.status,
    marketSegment: r.marketSegment,
    productInterest: r.productInterest,
    optIn: r.optIn,
    notes: r.notes,
    lastActivityAt: r.lastActivityAt,
    createdAt: r.createdAt,
    owner: r.owner,
    tags: r.tags,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold text-sysde-gray">Contactos</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {total.toLocaleString('es-MX')} contactos en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <Button variant="outline" asChild>
              <Link href="/contacts/import">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Link>
            </Button>
          )}
          {canExport && <ExportButton />}
          {canCreate && (
            <Button asChild>
              <Link href="/contacts/new">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo contacto
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ContactsFilters countries={countries} users={users} tags={tags} />

      {total === 0 && !hasAnyFilter ? (
        <div className="rounded-xl border border-sysde-border bg-white">
          <EmptyState
            icon={Users}
            title="Aún no tienes contactos"
            description="Empieza creando tu primer contacto o importa tu base existente desde un CSV."
            action={
              <>
                {canImport && (
                  <Button variant="outline" asChild>
                    <Link href="/contacts/import">
                      <Upload className="mr-2 h-4 w-4" />
                      Importar desde CSV
                    </Link>
                  </Button>
                )}
                {canCreate && (
                  <Button asChild>
                    <Link href="/contacts/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear contacto manualmente
                    </Link>
                  </Button>
                )}
              </>
            }
          />
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-sysde-border bg-white">
          <EmptyState
            icon={Users}
            title="No hay contactos que coincidan con los filtros"
            description="Prueba ajustando los filtros o limpiando tu búsqueda."
            action={
              <Button variant="outline" asChild>
                <Link href="/contacts">Limpiar filtros</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ContactsTable
          rows={tableRows}
          total={total}
          page={filters.page}
          pageSize={filters.pageSize}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          tags={tags}
          currentUserId={session.user.id}
          can={{
            updateAll: can(session, 'contacts:update:all'),
            updateOwn: can(session, 'contacts:update:own'),
            delete: can(session, 'contacts:delete'),
            exportCsv: canExport,
          }}
        />
      )}
    </div>
  );
}
