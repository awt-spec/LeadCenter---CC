import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthSessionProvider } from '@/components/providers/session-provider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = {
    name: session.user.name ?? session.user.email ?? 'Usuario',
    email: session.user.email ?? '',
    image: session.user.image ?? null,
    roles: session.user.roles ?? [],
  };

  return (
    <AuthSessionProvider>
      <div className="min-h-screen bg-sysde-bg">
        <Sidebar user={user} permissions={session.user.permissions ?? []} />
        <div className="pl-[240px]">
          <Topbar />
          <main className="min-h-[calc(100vh-56px)] p-8">{children}</main>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
