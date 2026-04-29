import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ contacts: [], accounts: [], opportunities: [], campaigns: [] });
  }

  // Use FTS for contacts/accounts when available; fall back to ILIKE
  const tsq = q.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean).join(' & ');

  const [contacts, accounts, opportunities, campaigns] = await Promise.all([
    tsq
      ? prisma.$queryRaw<{ id: string; fullName: string; email: string; companyName: string | null }[]>`
          SELECT id, "fullName", email, "companyName"
          FROM "Contact"
          WHERE search_vector @@ to_tsquery('spanish', ${tsq})
          ORDER BY ts_rank(search_vector, to_tsquery('spanish', ${tsq})) DESC
          LIMIT 6
        `
      : Promise.resolve([]),
    tsq
      ? prisma.$queryRaw<{ id: string; name: string; domain: string | null; country: string | null }[]>`
          SELECT id, name, domain, country
          FROM "Account"
          WHERE search_vector @@ to_tsquery('spanish', ${tsq})
          ORDER BY ts_rank(search_vector, to_tsquery('spanish', ${tsq})) DESC
          LIMIT 6
        `
      : Promise.resolve([]),
    prisma.opportunity.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { account: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        stage: true,
        account: { select: { id: true, name: true } },
      },
      take: 6,
    }),
    prisma.campaign.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, code: true, type: true, status: true },
      take: 6,
    }),
  ]);

  return NextResponse.json({ contacts, accounts, opportunities, campaigns });
}
