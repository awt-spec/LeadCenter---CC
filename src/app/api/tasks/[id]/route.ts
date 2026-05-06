import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTaskById } from '@/lib/tasks/queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const task = await getTaskById(id);
  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // OPT-010: cache-control. El task drawer hace GET en open + después de
  // cada mutation (refetch). Con cache de 30s, el "abrir-cerrar-abrir"
  // sirve del cache. Mutations llaman router.refresh que invalida igual.
  return NextResponse.json(
    { task },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } }
  );
}
