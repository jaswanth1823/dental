import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.ts';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  generateCsrfToken,
  requireAuth,
  signSessionToken,
  verifyCsrf,
} from '../middleware/auth.ts';

const router = Router();

router.post('/login', (req, res) => {
  const { identifier, password, rememberMe } = req.body as {
    identifier?: string;
    password?: string;
    rememberMe?: boolean;
  };

  const cleanId = (identifier || '').trim().toLowerCase();
  if (!cleanId || !password) {
    res.status(400).json({ error: 'Email or username and password are required.' });
    return;
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, d.id as dentist_id
    FROM users u
    LEFT JOIN staff s ON s.user_id = u.id
    LEFT JOIN dentists d ON d.staff_id = s.id
    WHERE LOWER(u.email) = ? OR LOWER(u.username) = ?
  `).get(cleanId, cleanId) as
    | {
        id: number;
        username: string;
        email: string;
        password_hash: string;
        full_name: string;
        role: 'Administrator' | 'Dentist' | 'Receptionist';
        avatar_url: string | null;
        notif_appointments: number;
        notif_followups: number;
        notif_billing: number;
        is_active: number;
        dentist_id: number | null;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
    return;
  }

  if (user.is_active !== 1) {
    res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
    return;
  }

  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const sessionToken = signSessionToken(user.id, Boolean(rememberMe));
  const csrfToken = generateCsrfToken();

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  });

  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  });

  res.json({
    csrfToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      notif_appointments: user.notif_appointments,
      notif_followups: user.notif_followups,
      notif_billing: user.notif_billing,
      dentist_id: user.dentist_id ?? null,
    },
  });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const csrfToken = req.cookies?.[CSRF_COOKIE] || generateCsrfToken();
  if (!req.cookies?.[CSRF_COOKIE]) {
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
  res.json({ user: req.user, csrfToken });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  res.json({
    message:
      'If an account matches that email address, password reset instructions have been queued by the clinic administrator.',
  });
});

router.put('/profile', requireAuth, verifyCsrf, (req, res) => {
  const { full_name, notif_appointments, notif_followups, notif_billing } = req.body as {
    full_name?: string;
    notif_appointments?: number;
    notif_followups?: number;
    notif_billing?: number;
  };

  if (!full_name || full_name.trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }

  const db = getDb();
  db.prepare(`
    UPDATE users
    SET full_name = ?, notif_appointments = ?, notif_followups = ?, notif_billing = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    full_name.trim(),
    notif_appointments ? 1 : 0,
    notif_followups ? 1 : 0,
    notif_billing ? 1 : 0,
    req.user!.id
  );

  db.prepare(`UPDATE staff SET full_name = ?, updated_at = datetime('now') WHERE user_id = ?`).run(
    full_name.trim(),
    req.user!.id
  );

  res.json({ ok: true, full_name: full_name.trim() });
});

router.put('/password', requireAuth, verifyCsrf, (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as
    | { password_hash: string }
    | undefined;

  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
    nextHash,
    req.user!.id
  );

  res.json({ ok: true });
});

export default router;
