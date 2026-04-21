import { prisma } from '@/lib/db';

export async function generateOpportunityCode(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.opportunity.findFirst({
    where: { code: { startsWith: `OPP-${year}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const lastNum = last?.code ? parseInt(last.code.split('-')[2] ?? '0', 10) : 0;
  const nextNum = (lastNum + 1).toString().padStart(4, '0');
  return `OPP-${year}-${nextNum}`;
}
