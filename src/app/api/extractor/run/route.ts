import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { runExtractor, rowsToCsv } from '@/lib/extractor/run';
import type { ExtractorConfig } from '@/lib/extractor/schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { config?: ExtractorConfig; format?: 'json' | 'csv' };
  if (!body.config) return NextResponse.json({ error: 'config requerido' }, { status: 400 });

  try {
    const result = await runExtractor(session, body.config);
    if (body.format === 'csv') {
      const csv = rowsToCsv(result.rows, body.config.columns, body.config.entity);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="extractor-${body.config.entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
