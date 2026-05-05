import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { summariseResults } from '@/lib/extractor/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    rows?: Record<string, unknown>[];
    columns?: string[];
  };
  if (!body.prompt || !Array.isArray(body.rows) || !Array.isArray(body.columns)) {
    return NextResponse.json({ error: 'prompt, rows y columns son requeridos' }, { status: 400 });
  }
  try {
    const insights = await summariseResults(body.prompt, body.rows, body.columns);
    return NextResponse.json({ ok: true, insights });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
