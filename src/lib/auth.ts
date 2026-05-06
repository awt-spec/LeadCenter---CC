import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';
import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_PERMISSIONS,
  DEMO_ROLES,
  DEMO_USER_ID,
  isDemoCredentials,
} from '@/lib/demo';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function loadUserPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!user) return { roles: [] as string[], permissions: [] as string[] };
  const roles = user.roles.map((ur) => ur.role.key);
  const permissions = Array.from(
    new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key)))
  );
  return { roles, permissions };
}

async function writeAuditLog(
  userId: string | null,
  action: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource: 'auth',
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Demo bypass — prefer the real seeded user if present, fall back to
        // a synthetic id so the button still works against a fresh DB.
        if (isDemoCredentials(email, password)) {
          const real = await prisma.user
            .findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } })
            .catch(() => null);
          return {
            id: real?.id ?? DEMO_USER_ID,
            email: DEMO_EMAIL,
            name: DEMO_NAME,
          };
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      if (account?.provider === 'credentials') {
        // Demo user — skip DB write
        if (user.id === DEMO_USER_ID) return true;

        await prisma.user.update({
          where: { email },
          data: { lastLoginAt: new Date() },
        });
        return true;
      }

      return false;
    },

    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.userId = user.id;

        // Demo user — hard-coded perms, no DB hit
        if (user.id === DEMO_USER_ID) {
          token.roles = DEMO_ROLES;
          token.permissions = DEMO_PERMISSIONS;
          return token;
        }

        const { roles, permissions } = await loadUserPermissions(user.id);
        token.roles = roles;
        token.permissions = permissions;
        // OPT-008: fire-and-forget. Antes bloqueaba el login esperando que
        // auditLog.create terminara. El catch interno de writeAuditLog ya
        // protege ante errores DB.
        void writeAuditLog(user.id, 'login').catch(() => undefined);
      } else if (trigger === 'update' && token.userId) {
        if (token.userId === DEMO_USER_ID) {
          token.roles = DEMO_ROLES;
          token.permissions = DEMO_PERMISSIONS;
          return token;
        }
        const { roles, permissions } = await loadUserPermissions(token.userId);
        token.roles = roles;
        token.permissions = permissions;
      }
      return token;
    },
  },
  events: {
    async signOut(message) {
      const userId =
        'token' in message && message.token?.userId
          ? (message.token.userId as string)
          : null;
      if (userId === DEMO_USER_ID) return;
      // OPT-008: fire-and-forget. Logout debería completar inmediatamente
      // — no queremos que el user vea spinner mientras escribimos un log.
      void writeAuditLog(userId, 'logout').catch(() => undefined);
    },
  },
});
