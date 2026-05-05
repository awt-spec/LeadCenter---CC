import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cocPreviewSchema } from '@/lib/coc/schemas';
import { fetchUrlPreview, detectLinkType, getDomain } from '@/lib/coc/url-preview';

/// POST /api/coc/preview { url } → { title, description, thumbnail, domain, type }
/// Used by the "Add link" dialog to prefill the title and show a thumbnail
/// before persisting the link. Best-effort — never throws on a bad URL,
/// returns whatever metadata could be scraped.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = cocPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  const { url } = parsed.data;
  const preview = await fetchUrlPreview(url);
  return NextResponse.json({
    title: preview.title ?? null,
    description: preview.description ?? null,
    thumbnail: preview.thumbnail ?? null,
    domain: preview.domain ?? getDomain(url),
    type: preview.type ?? detectLinkType(url),
  });
}
