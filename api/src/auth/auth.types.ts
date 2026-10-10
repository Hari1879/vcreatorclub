export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export type AdminRole = 'super_admin' | 'admin' | 'viewer';

export interface AdminContext {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    sessionUser?: SessionUser;
    admin?: AdminContext;
  }
}

export const SESSION_COOKIE = 'vcc_session';
