'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Crown, Megaphone, Database, ShieldCheck, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/// Quick-login credentials — los 5 perfiles activos del equipo SYSDE.
/// Pensado para acelerar el día a día (en dev / staging) sin tener que
/// memorizar el password. Si querés desactivar esto en prod, comentá la
/// sección de QuickLogin más abajo.
const QUICK_USERS = [
  { email: 'ewheelock@sysde.com', name: 'Eduardo', role: 'CEO',          icon: Crown,        accent: 'border-sysde-red bg-sysde-red text-white' },
  { email: 'alwheelock@sysde.com', name: 'Alberto', role: 'Admin',       icon: ShieldCheck,  accent: 'border-sysde-red/40 bg-white text-sysde-gray' },
  { email: 'kcastro@sysde.com', name: 'Katherine', role: 'Marketing',    icon: Megaphone,    accent: 'border-sysde-red/40 bg-white text-sysde-gray' },
  { email: 'swheelock@sysde.com', name: 'Sebastián', role: 'BD',         icon: Database,     accent: 'border-sysde-red/40 bg-white text-sysde-gray' },
  { email: 'demo@sysde.com', name: 'Demo', role: 'Sandbox',              icon: FlaskConical, accent: 'border-neutral-300 bg-neutral-50 text-sysde-mid' },
] as const;
const QUICK_PASSWORD = 'sysde2026';

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
  const [quickEmail, setQuickEmail] = useState<string | null>(null);

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

  async function handleQuickSignIn(email: string) {
    setQuickEmail(email);
    const result = await signIn('credentials', {
      email,
      password: QUICK_PASSWORD,
      redirect: false,
    });
    setQuickEmail(null);

    if (!result || result.error) {
      toast.error(`No se pudo entrar como ${email}`, {
        description: 'Verificá que el usuario exista o pedí al admin que reset el password.',
      });
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[480px]">
      <div className="rounded-xl border border-sysde-border bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="text-2xl font-bold text-sysde-red tracking-tight">SYSDE</div>
          <h1 className="mt-4 text-[28px] font-semibold text-sysde-gray">Lead Center</h1>
          <p className="mt-1 text-sm text-sysde-mid">Accede con tu cuenta corporativa</p>
        </div>

        {errorParam && (
          <div className="mb-6 rounded-lg bg-sysde-red-light px-4 py-3 text-sm text-sysde-red">
            No pudimos iniciar sesión. Verifica tu email y contraseña.
          </div>
        )}

        {/* Quick login — 5 perfiles activos del equipo */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sysde-mid">
              Acceso rápido
            </span>
            <div className="h-px flex-1 bg-sysde-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_USERS.map((u) => {
              const Icon = u.icon;
              const loading = quickEmail === u.email;
              const disabled = quickEmail !== null;
              return (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => handleQuickSignIn(u.email)}
                  disabled={disabled}
                  className={`group flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left transition disabled:cursor-not-allowed ${u.accent} ${disabled && !loading ? 'opacity-50' : ''} hover:scale-[1.02] hover:shadow-sm`}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{u.name}</p>
                    <p className="text-[10px] uppercase tracking-wide opacity-75 leading-tight mt-0.5">
                      {u.role}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10px] text-sysde-mid">
            Click para entrar como ese perfil — pass común: <code className="font-mono text-sysde-gray">sysde2026</code>
          </p>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-sysde-border" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-sysde-mid">o ingresar manual</span>
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
    </div>
  );
}
