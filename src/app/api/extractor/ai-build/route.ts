import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { buildConfigFromPrompt } from '@/lib/extractor/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'prompt requerido' }, { status: 400 });

  try {
    const config = await buildConfigFromPrompt(prompt);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
