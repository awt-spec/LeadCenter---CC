import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { prisma } from '@/lib/db';
import { CustomFieldsManager } from './manager';

export const metadata = { title: 'Campos personalizados' };

export default async function CustomFieldsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!hasRole(session, 'admin')) {
    return <Forbidden message="Solo administradores pueden gestionar campos personalizados." />;
  }

  const fields = await prisma.customFieldDefinition.findMany({
    orderBy: [{ entity: 'asc' }, { position: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sysde-red">
          Configuración
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-sysde-gray sm:text-3xl">
          Campos personalizados
        </h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Extiende el modelo de datos. Crea campos custom para contactos, cuentas u oportunidades —
          se renderizan automáticamente en cada formulario.
        </p>
      </div>

      <CustomFieldsManager
        initial={fields.map((f) => ({
          id: f.id,
          entity: f.entity,
          key: f.key,
          label: f.label,
          type: f.type,
          options: f.options,
          required: f.required,
          description: f.description,
        }))}
      />
    </div>
  );
}
