'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const errorParam = searchParams.get('error');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setIsSubmitting(false);

    if (!result || result.error) {
      toast.error('Credenciales inválidas', {
        description: 'Revisa tu email y contraseña e intenta de nuevo.',
      });
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleDemoSignIn() {
    setIsDemoSubmitting(true);
    const result = await signIn('credentials', {
      email: 'demo@sysde.com',
      password: 'demo1234',
      redirect: false,
    });
    setIsDemoSubmitting(false);

    if (!result || result.error) {
      toast.error('No se pudo entrar como demo', {
        description: 'El usuario demo aún no está creado en la base. Contacta al admin.',
      });
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-xl border border-sysde-border bg-white p-10 shadow-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="text-2xl font-bold text-sysde-red tracking-tight">SYSDE</div>
          <h1 className="mt-6 text-[28px] font-semibold text-sysde-gray">Lead Center</h1>
          <p className="mt-1 text-sm text-sysde-mid">Accede con tu cuenta corporativa</p>
        </div>

        {errorParam && (
          <div className="mb-6 rounded-lg bg-sysde-red-light px-4 py-3 text-sm text-sysde-red">
            No pudimos iniciar sesión. Verifica tu email y contraseña.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@sysde.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
          </div>

          <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-sysde-border" />
          <span className="text-xs uppercase tracking-wide text-sysde-mid">demo</span>
          <div className="h-px flex-1 bg-sysde-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="xl"
          className="w-full"
          onClick={handleDemoSignIn}
          disabled={isDemoSubmitting}
        >
          {isDemoSubmitting ? 'Entrando…' : 'Entrar como demo'}
        </Button>
        <p className="mt-2 text-center text-[11px] text-sysde-mid">
          Cuenta demo con acceso completo · datos de muestra.
        </p>
      </div>
    </div>
  );
}
