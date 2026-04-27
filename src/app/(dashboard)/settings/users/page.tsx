import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export const metadata = { title: 'Usuarios' };

export default async function UsersSettingsPage() {
  const session = await auth();
  if (!can(session, 'users:read')) {
    return <Forbidden message="Solo administradores pueden gestionar usuarios." />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-sysde-gray">Usuarios</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            Gestiona los usuarios del Lead Center y asigna sus roles.
          </p>
        </div>
        {can(session, 'users:invite') && (
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar usuario
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipo SYSDE</CardTitle>
          <CardDescription>
            Tabla placeholder. La gestión completa de usuarios llegará en la siguiente fase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-sysde-border">
            <table className="w-full text-sm">
              <thead className="bg-sysde-bg text-left text-xs font-semibold uppercase tracking-wide text-sysde-mid">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-sysde-mid" colSpan={4}>
                    Aún no hay usuarios listados. Esta tabla se implementará en la siguiente fase.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
