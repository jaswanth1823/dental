import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.ts';

export type UserRole = 'Administrator' | 'Dentist' | 'Receptionist';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  notif_appointments: number;
  notif_followups: number;
  notif_billing: number;
  dentist_id: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'clarity-dental-dev-session-secret-key-2026';
export const SESSION_COOKIE = 'dcms_session';
export const CSRF_COOKIE = 'dcms_csrf';

interface SessionPayload {
  userId: number;
  exp: number;
}

export function signSessionToken(userId: number, rememberMe: boolean): string {
  const ttlMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const payload: SessionPayload = {
    userId,
    exp: Date.now() + ttlMs,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const db = getDb();
  const userRow = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.avatar_url,
           u.notif_appointments, u.notif_followups, u.notif_billing, u.is_active,
           d.id as dentist_id
    FROM users u
    LEFT JOIN staff s ON s.user_id = u.id
    LEFT JOIN dentists d ON d.staff_id = s.id
    WHERE u.id = ?
  `).get(verified.userId) as (AuthUser & { is_active: number }) | undefined;

  if (!userRow || userRow.is_active !== 1) {
    res.status(401).json({ error: 'User account is inactive or missing.' });
    return;
  }

  req.user = {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    full_name: userRow.full_name,
    role: userRow.role,
    avatar_url: userRow.avatar_url,
    notif_appointments: userRow.notif_appointments,
    notif_followups: userRow.notif_followups,
    notif_billing: userRow.notif_billing,
    dentist_id: userRow.dentist_id ?? null,
  };
  next();
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const cookieCsrf = req.cookies?.[CSRF_COOKIE];
  const headerCsrf = req.headers['x-csrf-token'];
  if (!cookieCsrf || typeof headerCsrf !== 'string' || cookieCsrf !== headerCsrf) {
    res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. ${req.user.role} role does not have permission for this action.`,
      });
      return;
    }
    next();
  };
}
