import { auth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PLACEHOLDER_CARDS = [
  { title: 'Contactos', description: 'Total de contactos activos en el sistema.' },
  { title: 'Cuentas', description: 'Cuentas con oportunidades abiertas.' },
  { title: 'Oportunidades', description: 'Pipeline ponderado del mes actual.' },
  { title: 'Actividades', description: 'Seguimientos pendientes esta semana.' },
];

export default async function HomePage() {
  const session = await auth();
  const name = session?.user?.name?.split(' ')[0] ?? 'colega';

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-sysde-gray">
          Bienvenido al Lead Center, {name}
        </h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Esta es la fundación del CRM interno de SYSDE. Los módulos se irán habilitando en las próximas fases.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_CARDS.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-sysde-gray">—</div>
              <div className="mt-1 text-xs text-sysde-mid">Próximamente</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
