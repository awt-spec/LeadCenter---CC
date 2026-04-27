import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { accountsToCsvString, type ExportableAccount } from '@/lib/export/csv-export';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(session, 'accounts:read:all') && !can(session, 'accounts:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const where = can(session, 'accounts:read:all')
    ? {}
    : {
        OR: [
          { ownerId: session.user.id },
          { opportunities: { some: { ownerId: session.user.id } } },
        ],
      };

  const accounts = await prisma.account.findMany({
    where,
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { contacts: true, opportunities: true } },
      opportunities: { where: { status: 'OPEN' }, select: { estimatedValue: true } },
    },
    orderBy: { name: 'asc' },
    take: 10000,
  });

  const exportable: ExportableAccount[] = accounts.map((a) => ({
    name: a.name,
    legalName: a.legalName,
    domain: a.domain,
    website: a.website,
    segment: a.segment,
    industry: a.industry,
    size: a.size,
    employeeCount: a.employeeCount,
    annualRevenue: a.annualRevenue ? Number(a.annualRevenue) : null,
    currency: a.currency,
    country: a.country,
    region: a.region,
    city: a.city,
    status: a.status,
    priority: a.priority,
    ownerName: a.owner?.name ?? null,
    ownerEmail: a.owner?.email ?? null,
    contactsCount: a._count.contacts,
    opportunitiesCount: a._count.opportunities,
    pipelineTotal: a.opportunities.reduce(
      (acc, o) => acc + (o.estimatedValue ? Number(o.estimatedValue) : 0),
      0
    ),
    description: a.description,
    createdAt: a.createdAt,
  }));

  const csv = accountsToCsvString(exportable);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cuentas-sysde-${date}.csv"`,
    },
  });
}
