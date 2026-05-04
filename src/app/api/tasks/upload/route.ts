// File upload endpoint for task attachments. Uses Vercel Blob — the user
// must enable a Blob store in the Vercel dashboard (one click) which
// auto-provisions BLOB_READ_WRITE_TOKEN.
//
// Returns: { url, fileName, fileSize, mimeType } on success.

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
// Allow up to 25MB per file (Asana's free plan caps at 100MB; this is plenty
// for most attachments without burning Blob quota).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Vercel Blob is not configured. Crea un Blob store en Vercel → Storage y conectarlo al proyecto. Eso provisiona BLOB_READ_WRITE_TOKEN automáticamente.',
      },
      { status: 503 }
    );
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta archivo' }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo > 25MB' }, { status: 413 });
  }

  // Path under the user's id keeps blobs grouped + makes audit trivial.
  const key = `tasks/${session.user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
  try {
    const blob = await put(key, file, {
      access: 'public',
      addRandomSuffix: false,
      contentType: file.type || 'application/octet-stream',
    });
    return NextResponse.json({
      url: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
