import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { listContacts } from '@/lib/contacts/queries';
import { contactFilterSchema } from '@/lib/contacts/schemas';
import { contactsToCsvString } from '@/lib/export/csv-export';
import { logExportEvent } from '@/lib/contacts/mutations';

function arr(sp: URLSearchParams, key: string): string[] | undefined {
  const v = sp.getAll(key);
  return v.length ? v : undefined;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(session, 'contacts:export_csv')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const sp = url.searchParams;

  const filters = contactFilterSchema.parse({
    q: sp.get('q') ?? undefined,
    country: arr(sp, 'country'),
    status: arr(sp, 'status'),
    source: arr(sp, 'source'),
    ownerId: arr(sp, 'ownerId'),
    marketSegment: arr(sp, 'marketSegment'),
    productInterest: arr(sp, 'productInterest'),
    tagIds: arr(sp, 'tagIds'),
    createdFrom: sp.get('createdFrom') ?? undefined,
    createdTo: sp.get('createdTo') ?? undefined,
    importBatchId: sp.get('importBatchId') ?? undefined,
    page: 1,
    pageSize: 10000,
    sortBy: sp.get('sortBy') ?? 'createdAt',
    sortDir: sp.get('sortDir') === 'asc' ? 'asc' : 'desc',
  });

  const { rows } = await listContacts(session, filters);

  const csv = contactsToCsvString(
    rows.map((r) => ({
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
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
      owner: r.owner ? { name: r.owner.name, email: r.owner.email } : null,
      tags: r.tags.map((t) => t.tag.name),
      optIn: r.optIn,
      notes: r.notes,
      createdAt: r.createdAt,
    }))
  );

  await logExportEvent(filters, rows.length);

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contactos-sysde-${date}.csv"`,
    },
  });
}
