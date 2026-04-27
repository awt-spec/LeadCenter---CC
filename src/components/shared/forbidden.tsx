import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md pt-16">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sysde-red-light text-sysde-red">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle>Acceso denegado · 403</CardTitle>
          <CardDescription>
            {message ?? 'No tienes permisos para ver esta sección. Contacta al administrador si crees que es un error.'}
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
