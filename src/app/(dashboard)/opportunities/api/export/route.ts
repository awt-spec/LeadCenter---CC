import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { opportunitiesToCsvString, type ExportableOpportunity } from '@/lib/export/csv-export';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const where = can(session, 'opportunities:read:all')
    ? {}
    : { ownerId: session.user.id };

  const opps = await prisma.opportunity.findMany({
    where,
    include: {
      account: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const exportable: ExportableOpportunity[] = opps.map((o) => ({
    code: o.code,
    name: o.name,
    accountName: o.account.name,
    product: o.product,
    subProduct: o.subProduct,
    stage: o.stage,
    status: o.status,
    rating: o.rating,
    probability: o.probability,
    estimatedValue: o.estimatedValue ? Number(o.estimatedValue) : null,
    currency: o.currency,
    commercialModel: o.commercialModel,
    expectedCloseDate: o.expectedCloseDate,
    closedAt: o.closedAt,
    ownerName: o.owner?.name ?? null,
    ownerEmail: o.owner?.email ?? null,
    source: o.source,
    lostReason: o.lostReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }));

  const csv = opportunitiesToCsvString(exportable);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="oportunidades-sysde-${date}.csv"`,
    },
  });
}
