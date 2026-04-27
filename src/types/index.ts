import type { DefaultSession } from 'next-auth';
import 'next-auth/jwt';

export interface SessionUserExtras {
  id: string;
  roles: string[];
  permissions: string[];
}

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & SessionUserExtras;
  }

  interface User {
    roles?: string[];
    permissions?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    roles?: string[];
    permissions?: string[];
  }
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: string;
}
