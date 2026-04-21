import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/constants';
import { authConfig } from '@/lib/auth.config';

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

      if (account?.provider === 'google') {
        if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return false;

        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {
            name: user.name ?? email,
            avatarUrl: user.image ?? undefined,
            googleId: account.providerAccountId,
            lastLoginAt: new Date(),
          },
          create: {
            email,
            name: user.name ?? email,
            avatarUrl: user.image ?? undefined,
            googleId: account.providerAccountId,
            isActive: true,
            lastLoginAt: new Date(),
          },
        });

        if (!dbUser.isActive) return false;
        user.id = dbUser.id;
        return true;
      }

      if (account?.provider === 'credentials') {
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
        const { roles, permissions } = await loadUserPermissions(user.id);
        token.roles = roles;
        token.permissions = permissions;
        await writeAuditLog(user.id, 'login');
      } else if (trigger === 'update' && token.userId) {
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
      await writeAuditLog(userId, 'logout');
    },
  },
});
