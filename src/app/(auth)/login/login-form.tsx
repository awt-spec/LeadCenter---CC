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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.98 10.98 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a10.98 10.98 0 0 0 0 9.92l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const errorParam = searchParams.get('error');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

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

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true);
    await signIn('google', { callbackUrl });
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
            No pudimos iniciar sesión. Verifica que uses una cuenta @sysde.com activa.
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="xl"
          className="w-full gap-3"
          onClick={handleGoogleSignIn}
          disabled={isGoogleSubmitting}
        >
          <GoogleIcon />
          <span>Continuar con Google</span>
        </Button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-sysde-border" />
          <span className="text-xs uppercase tracking-wide text-sysde-mid">o</span>
          <div className="h-px flex-1 bg-sysde-border" />
        </div>

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
      </div>

      <p className="mt-6 text-center text-xs text-sysde-mid">
        Solo usuarios con cuenta corporativa @sysde.com
      </p>
    </div>
  );
}
