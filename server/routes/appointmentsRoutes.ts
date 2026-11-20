import { Router } from 'express';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth, verifyCsrf);

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getWeekdayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()];
}

function checkDentistConflict(
  dentistId: number,
  date: string,
  time: string,
  durationMinutes: number,
  excludeApptId?: number
): string | null {
  const db = getDb();
  const dentist = db
    .prepare(`
      SELECT d.*, s.full_name, s.status
      FROM dentists d JOIN staff s ON s.id = d.staff_id
      WHERE d.id = ?
    `)
    .get(dentistId) as
    | {
        id: number;
        full_name: string;
        status: string;
        available_days: string;
        start_hour: string;
        end_hour: string;
      }
    | undefined;

  if (!dentist) {
    return 'Selected dentist does not exist.';
  }
  if (dentist.status !== 'Active') {
    return `${dentist.full_name} is currently marked as ${dentist.status}.`;
  }

  const day = getWeekdayShort(date);
  const allowedDays = dentist.available_days.split(',').map((s) => s.trim());
  if (!allowedDays.includes(day)) {
    return `${dentist.full_name} is not scheduled to work on ${day} (${dentist.available_days}).`;
  }

  const reqStart = toMinutes(time);
  const reqEnd = reqStart + durationMinutes;
  const workStart = toMinutes(dentist.start_hour);
  const workEnd = toMinutes(dentist.end_hour);

  if (reqStart < workStart || reqEnd > workEnd) {
    return `${dentist.full_name} is available from ${dentist.start_hour} to ${dentist.end_hour}.`;
  }

  const existing = db
    .prepare(`
      SELECT id, appointment_code, appointment_time, duration_minutes
      FROM appointments
      WHERE dentist_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled', 'No-show')
    `)
    .all(dentistId, date) as Array<{
    id: number;
    appointment_code: string;
    appointment_time: string;
    duration_minutes: number;
  }>;

  for (const appt of existing) {
    if (excludeApptId && appt.id === excludeApptId) continue;
    const existStart = toMinutes(appt.appointment_time);
    const existEnd = existStart + appt.duration_minutes;
    if (reqStart < existEnd && reqEnd > existStart) {
      return `Time conflict with ${appt.appointment_code} (${appt.appointment_time} for ${appt.duration_minutes} min) for ${dentist.full_name}.`;
    }
  }

  return null;
}

router.get('/', (_req, res) => {
  const db = getDb();
  const appointments = db.prepare(`
    SELECT a.*,
           p.full_name as patient_name, p.patient_code, p.phone as patient_phone,
           s.full_name as dentist_name, d.specialization as dentist_specialization,
           t.name as treatment_name, t.cost as treatment_cost
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = a.treatment_id
    ORDER BY a.appointment_date DESC, a.appointment_time ASC
  `).all();
  res.json({ appointments });
});

router.get('/availability', (req, res) => {
  const dentistId = Number(req.query.dentist_id);
  const date = String(req.query.date || '');
  if (!dentistId || !date) {
    res.status(400).json({ error: 'dentist_id and date are required.' });
    return;
  }

  const db = getDb();
  const dentist = db
    .prepare(`
      SELECT d.*, s.full_name, s.status
      FROM dentists d JOIN staff s ON s.id = d.staff_id
      WHERE d.id = ?
    `)
    .get(dentistId) as
    | {
        id: number;
        full_name: string;
        status: string;
        available_days: string;
        start_hour: string;
        end_hour: string;
      }
    | undefined;

  if (!dentist) {
    res.status(404).json({ error: 'Dentist not found.' });
    return;
  }

  const booked = db
    .prepare(`
      SELECT id, appointment_code, appointment_time, duration_minutes, status
      FROM appointments
      WHERE dentist_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled', 'No-show')
      ORDER BY appointment_time ASC
    `)
    .all(dentistId, date);

  const day = getWeekdayShort(date);
  const worksOnDay = dentist.status === 'Active' && dentist.available_days.split(',').map((s) => s.trim()).includes(day);

  res.json({
    dentist_name: dentist.full_name,
    works_on_day: worksOnDay,
    available_days: dentist.available_days,
    start_hour: dentist.start_hour,
    end_hour: dentist.end_hour,
    booked_slots: booked,
  });
});

router.post('/', requireRole('Administrator', 'Receptionist', 'Dentist'), (req, res) => {
  const { patient_id, dentist_id, treatment_id, appointment_date, appointment_time, duration_minutes, status, notes } =
    req.body as {
      patient_id?: number;
      dentist_id?: number;
      treatment_id?: number;
      appointment_date?: string;
      appointment_time?: string;
      duration_minutes?: number;
      status?: string;
      notes?: string;
    };

  if (!patient_id || !dentist_id || !treatment_id || !appointment_date || !appointment_time) {
    res.status(400).json({ error: 'Patient, dentist, treatment, date, and time are required.' });
    return;
  }

  const duration = Number(duration_minutes) || 30;
  if (duration < 15 || duration > 240) {
    res.status(400).json({ error: 'Duration must be between 15 and 240 minutes.' });
    return;
  }

  const conflict = checkDentistConflict(Number(dentist_id), appointment_date, appointment_time, duration);
  if (conflict) {
    res.status(409).json({ error: conflict });
    return;
  }

  const db = getDb();
  const lastRow = db.prepare('SELECT MAX(id) as maxId FROM appointments').get() as { maxId: number | null };
  const appointment_code = `APT-${4001 + (lastRow.maxId || 0)}`;
  const finalStatus = status || 'Scheduled';

  const result = db.prepare(`
    INSERT INTO appointments (
      appointment_code, patient_id, dentist_id, treatment_id, appointment_date, appointment_time, duration_minutes, status, notes, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    appointment_code,
    Number(patient_id),
    Number(dentist_id),
    Number(treatment_id),
    appointment_date,
    appointment_time,
    duration,
    finalStatus,
    (notes || '').trim()
  );

  const pat = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(Number(patient_id)) as { full_name: string } | undefined;
  db.prepare(`
    INSERT INTO notifications (target_role, title, message, category, is_read, related_link)
    VALUES (NULL, ?, ?, 'appointment', 0, 'appointments')
  `).run(
    'New Appointment Scheduled',
    `${pat?.full_name || 'Patient'} booked for ${appointment_date} at ${appointment_time} (${appointment_code}).`
  );

  if (finalStatus === 'Completed') {
    db.prepare(`UPDATE patients SET last_visit = ?, updated_at = datetime('now') WHERE id = ?`).run(
      appointment_date,
      Number(patient_id)
    );
  }

  const created = db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name, t.name as treatment_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = a.treatment_id
    WHERE a.id = ?
  `).get(Number(result.lastInsertRowid));

  res.status(201).json({ appointment: created });
});

router.put('/:id', requireRole('Administrator', 'Receptionist', 'Dentist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const { patient_id, dentist_id, treatment_id, appointment_date, appointment_time, duration_minutes, status, notes } =
    req.body as {
      patient_id?: number;
      dentist_id?: number;
      treatment_id?: number;
      appointment_date?: string;
      appointment_time?: string;
      duration_minutes?: number;
      status?: string;
      notes?: string;
    };

  const nextPat = Number(patient_id || existing.patient_id);
  const nextDen = Number(dentist_id || existing.dentist_id);
  const nextTrt = Number(treatment_id || existing.treatment_id);
  const nextDate = appointment_date || String(existing.appointment_date);
  const nextTime = appointment_time || String(existing.appointment_time);
  const nextDur = Number(duration_minutes || existing.duration_minutes);
  const nextStatus = status || String(existing.status);

  if (!['Cancelled', 'No-show'].includes(nextStatus)) {
    const conflict = checkDentistConflict(nextDen, nextDate, nextTime, nextDur, id);
    if (conflict) {
      res.status(409).json({ error: conflict });
      return;
    }
  }

  db.prepare(`
    UPDATE appointments SET
      patient_id = ?, dentist_id = ?, treatment_id = ?, appointment_date = ?, appointment_time = ?,
      duration_minutes = ?, status = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nextPat, nextDen, nextTrt, nextDate, nextTime, nextDur, nextStatus, (notes ?? String(existing.notes || '')).trim(), id);

  if (nextStatus === 'Cancelled' && existing.status !== 'Cancelled') {
    const pat = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(nextPat) as { full_name: string } | undefined;
    db.prepare(`
      INSERT INTO notifications (target_role, title, message, category, is_read, related_link)
      VALUES (NULL, ?, ?, 'cancellation', 0, 'appointments')
    `).run(
      'Appointment Cancelled',
      `${pat?.full_name || 'Patient'} appointment ${existing.appointment_code} (${nextDate} ${nextTime}) was cancelled.`
    );
  }

  if (nextStatus === 'Completed') {
    db.prepare(`UPDATE patients SET last_visit = ?, updated_at = datetime('now') WHERE id = ?`).run(nextDate, nextPat);
  }

  const updated = db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name, t.name as treatment_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = a.treatment_id
    WHERE a.id = ?
  `).get(id);

  res.json({ appointment: updated });
});

router.delete('/:id', requireRole('Administrator', 'Receptionist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT id FROM appointments WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Follow-Ups endpoints
router.get('/follow-ups/list', (_req, res) => {
  const db = getDb();
  const followUps = db.prepare(`
    SELECT f.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name
    FROM follow_ups f
    JOIN patients p ON p.id = f.patient_id
    JOIN dentists d ON d.id = f.dentist_id
    JOIN staff s ON s.id = d.staff_id
    ORDER BY f.follow_up_date ASC, f.id DESC
  `).all();
  res.json({ followUps });
});

router.post('/follow-ups', requireRole('Administrator', 'Dentist', 'Receptionist'), (req, res) => {
  const { patient_id, dentist_id, follow_up_date, reason, notes, status } = req.body as {
    patient_id?: number;
    dentist_id?: number;
    follow_up_date?: string;
    reason?: string;
    notes?: string;
    status?: string;
  };

  if (!patient_id || !dentist_id || !follow_up_date || !reason?.trim()) {
    res.status(400).json({ error: 'Patient, dentist, follow-up date, and reason are required.' });
    return;
  }

  const db = getDb();
  const lastRow = db.prepare('SELECT MAX(id) as maxId FROM follow_ups').get() as { maxId: number | null };
  const followup_code = `FUP-${9001 + (lastRow.maxId || 0)}`;

  const result = db.prepare(`
    INSERT INTO follow_ups (followup_code, patient_id, dentist_id, follow_up_date, reason, notes, status, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(followup_code, Number(patient_id), Number(dentist_id), follow_up_date, reason.trim(), (notes || '').trim(), status || 'Pending');

  const pat = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(Number(patient_id)) as { full_name: string } | undefined;
  db.prepare(`
    INSERT INTO notifications (target_role, title, message, category, is_read, related_link)
    VALUES (NULL, ?, ?, 'followup', 0, 'appointments')
  `).run('Follow-Up Scheduled', `Follow-up scheduled for ${pat?.full_name || 'Patient'} on ${follow_up_date}.`);

  const created = db.prepare(`
    SELECT f.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name
    FROM follow_ups f
    JOIN patients p ON p.id = f.patient_id
    JOIN dentists d ON d.id = f.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE f.id = ?
  `).get(Number(result.lastInsertRowid));

  res.status(201).json({ followUp: created });
});

router.put('/follow-ups/:id', requireRole('Administrator', 'Dentist', 'Receptionist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Follow-up not found.' });
    return;
  }

  const { follow_up_date, reason, notes, status } = req.body as Record<string, string>;
  db.prepare(`
    UPDATE follow_ups SET
      follow_up_date = ?, reason = ?, notes = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    follow_up_date || String(existing.follow_up_date),
    (reason ?? String(existing.reason)).trim(),
    (notes ?? String(existing.notes || '')).trim(),
    status || String(existing.status),
    id
  );

  const updated = db.prepare(`
    SELECT f.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name
    FROM follow_ups f
    JOIN patients p ON p.id = f.patient_id
    JOIN dentists d ON d.id = f.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE f.id = ?
  `).get(id);

  res.json({ followUp: updated });
});

router.delete('/follow-ups/:id', requireRole('Administrator', 'Receptionist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM follow_ups WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
