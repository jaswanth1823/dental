import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth, verifyCsrf);

// ============================================================================
// STAFF & DENTISTS
// ============================================================================
router.get('/staff', (_req, res) => {
  const db = getDb();
  const staff = db.prepare(`
    SELECT s.*,
           d.id as dentist_id, d.specialization, d.license_number, d.bio,
           d.available_days, d.start_hour, d.end_hour
    FROM staff s
    LEFT JOIN dentists d ON d.staff_id = s.id
    ORDER BY
      CASE s.role WHEN 'Dentist' THEN 1 WHEN 'Administrator' THEN 2 ELSE 3 END,
      s.id ASC
  `).all();
  res.json({ staff });
});

router.get('/dentists', (_req, res) => {
  const db = getDb();
  const dentists = db.prepare(`
    SELECT d.id, d.staff_id, s.staff_code, s.full_name, s.phone, s.email, s.working_hours,
           s.avatar_url, s.status, d.specialization, d.license_number, d.bio,
           d.available_days, d.start_hour, d.end_hour
    FROM dentists d
    JOIN staff s ON s.id = d.staff_id
    ORDER BY s.full_name ASC
  `).all();
  res.json({ dentists });
});

router.post('/staff', requireRole('Administrator'), (req, res) => {
  const {
    full_name,
    role,
    phone,
    email,
    working_hours,
    status,
    specialization,
    license_number,
    bio,
    available_days,
    start_hour,
    end_hour,
    username,
    password,
  } = req.body as Record<string, string>;

  if (!full_name?.trim() || !role || !phone?.trim() || !email?.trim() || !working_hours?.trim()) {
    res.status(400).json({ error: 'Name, role, phone, email, and working hours are required.' });
    return;
  }

  if (role === 'Dentist' && (!specialization?.trim() || !license_number?.trim())) {
    res.status(400).json({ error: 'Specialization and license number are required for dentists.' });
    return;
  }

  const db = getDb();
  const dupEmail = db.prepare('SELECT id FROM staff WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (dupEmail) {
    res.status(409).json({ error: 'A staff member with this email already exists.' });
    return;
  }

  const lastRow = db.prepare('SELECT MAX(id) as maxId FROM staff').get() as { maxId: number | null };
  const staff_code = `STF-${2000 + (lastRow.maxId || 0) + 1}`;

  db.exec('BEGIN TRANSACTION;');
  try {
    let userId: number | null = null;
    if (username?.trim() && password?.trim()) {
      const hash = bcrypt.hashSync(password.trim(), 10);
      const uRes = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?)
      `).run(username.trim().toLowerCase(), email.trim().toLowerCase(), hash, full_name.trim(), role);
      userId = Number(uRes.lastInsertRowid);
    }

    const sRes = db.prepare(`
      INSERT INTO staff (staff_code, user_id, full_name, role, phone, email, working_hours, status, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      staff_code,
      userId,
      full_name.trim(),
      role,
      phone.trim(),
      email.trim().toLowerCase(),
      working_hours.trim(),
      status || 'Active'
    );
    const staffId = Number(sRes.lastInsertRowid);

    if (role === 'Dentist') {
      db.prepare(`
        INSERT INTO dentists (staff_id, specialization, license_number, bio, available_days, start_hour, end_hour)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        staffId,
        specialization.trim(),
        license_number.trim(),
        (bio || '').trim(),
        available_days || 'Mon,Tue,Wed,Thu,Fri',
        start_hour || '09:00',
        end_hour || '17:00'
      );
    }
    db.exec('COMMIT;');

    const created = db.prepare(`
      SELECT s.*, d.id as dentist_id, d.specialization, d.license_number, d.bio, d.available_days, d.start_hour, d.end_hour
      FROM staff s LEFT JOIN dentists d ON d.staff_id = s.id WHERE s.id = ?
    `).get(staffId);
    res.status(201).json({ member: created });
  } catch (err) {
    db.exec('ROLLBACK;');
    const message = err instanceof Error ? err.message : 'Unable to create staff member.';
    res.status(400).json({ error: message });
  }
});

router.put('/staff/:id', requireRole('Administrator'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Staff member not found.' });
    return;
  }

  const {
    full_name,
    phone,
    email,
    working_hours,
    status,
    specialization,
    license_number,
    bio,
    available_days,
    start_hour,
    end_hour,
  } = req.body as Record<string, string>;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE staff SET full_name = ?, phone = ?, email = ?, working_hours = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      (full_name || String(existing.full_name)).trim(),
      (phone || String(existing.phone)).trim(),
      (email || String(existing.email)).trim().toLowerCase(),
      (working_hours || String(existing.working_hours)).trim(),
      status || String(existing.status),
      id
    );

    if (existing.user_id) {
      db.prepare(`UPDATE users SET full_name = ?, email = ?, is_active = ? WHERE id = ?`).run(
        (full_name || String(existing.full_name)).trim(),
        (email || String(existing.email)).trim().toLowerCase(),
        status === 'Inactive' ? 0 : 1,
        Number(existing.user_id)
      );
    }

    if (existing.role === 'Dentist') {
      db.prepare(`
        UPDATE dentists SET
          specialization = COALESCE(?, specialization),
          license_number = COALESCE(?, license_number),
          bio = COALESCE(?, bio),
          available_days = COALESCE(?, available_days),
          start_hour = COALESCE(?, start_hour),
          end_hour = COALESCE(?, end_hour),
          updated_at = datetime('now')
        WHERE staff_id = ?
      `).run(
        specialization?.trim() || null,
        license_number?.trim() || null,
        bio !== undefined ? bio.trim() : null,
        available_days || null,
        start_hour || null,
        end_hour || null,
        id
      );
    }

    db.exec('COMMIT;');
    const updated = db.prepare(`
      SELECT s.*, d.id as dentist_id, d.specialization, d.license_number, d.bio, d.available_days, d.start_hour, d.end_hour
      FROM staff s LEFT JOIN dentists d ON d.staff_id = s.id WHERE s.id = ?
    `).get(id);
    res.json({ member: updated });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update staff.' });
  }
});

router.delete('/staff/:id', requireRole('Administrator'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as { user_id?: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Staff member not found.' });
    return;
  }
  if (existing.user_id === req.user?.id) {
    res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    return;
  }
  db.prepare('DELETE FROM staff WHERE id = ?').run(id);
  if (existing.user_id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);
  }
  res.json({ ok: true });
});

// ============================================================================
// TREATMENTS CATALOG & TREATMENT PLANS
// ============================================================================
router.get('/treatments', (_req, res) => {
  const db = getDb();
  const treatments = db.prepare('SELECT * FROM treatments ORDER BY id ASC').all();
  res.json({ treatments });
});

router.post('/treatments', requireRole('Administrator', 'Dentist'), (req, res) => {
  const { name, description, duration_minutes, cost, status } = req.body as {
    name?: string;
    description?: string;
    duration_minutes?: number;
    cost?: number;
    status?: string;
  };
  if (!name?.trim() || !description?.trim() || Number(cost) < 0) {
    res.status(400).json({ error: 'Treatment name, description, and valid cost are required.' });
    return;
  }

  const db = getDb();
  const dup = db.prepare('SELECT id FROM treatments WHERE LOWER(name) = LOWER(?)').get(name.trim());
  if (dup) {
    res.status(409).json({ error: 'A treatment with this name already exists.' });
    return;
  }

  const last = db.prepare('SELECT MAX(id) as maxId FROM treatments').get() as { maxId: number | null };
  const treatment_code = `TRT-${3001 + (last.maxId || 0)}`;
  const result = db.prepare(`
    INSERT INTO treatments (treatment_code, name, description, duration_minutes, cost, status, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(treatment_code, name.trim(), description.trim(), Number(duration_minutes) || 30, Number(cost), status === 'Archived' ? 'Archived' : 'Active');

  const created = db.prepare('SELECT * FROM treatments WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ treatment: created });
});

router.put('/treatments/:id', requireRole('Administrator', 'Dentist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Treatment not found.' });
    return;
  }

  const { name, description, duration_minutes, cost, status } = req.body as {
    name?: string;
    description?: string;
    duration_minutes?: number;
    cost?: number;
    status?: string;
  };

  db.prepare(`
    UPDATE treatments SET name = ?, description = ?, duration_minutes = ?, cost = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    (name || String(existing.name)).trim(),
    (description || String(existing.description)).trim(),
    Number(duration_minutes || existing.duration_minutes),
    cost !== undefined ? Number(cost) : Number(existing.cost),
    status || String(existing.status),
    id
  );
  const updated = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id);
  res.json({ treatment: updated });
});

router.delete('/treatments/:id', requireRole('Administrator'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  try {
    db.prepare('DELETE FROM treatments WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Treatment is referenced by appointments or plans. Archive it instead.' });
  }
});

router.get('/treatment-plans', (_req, res) => {
  const db = getDb();
  const plans = db.prepare(`
    SELECT tp.*, p.full_name as patient_name, p.patient_code,
           s.full_name as dentist_name, t.name as treatment_name
    FROM treatment_plans tp
    JOIN patients p ON p.id = tp.patient_id
    JOIN dentists d ON d.id = tp.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = tp.treatment_id
    ORDER BY tp.start_date DESC, tp.id DESC
  `).all();
  res.json({ plans });
});

router.post('/treatment-plans', requireRole('Administrator', 'Dentist'), (req, res) => {
  const { patient_id, dentist_id, treatment_id, diagnosis, treatment_notes, estimated_cost, start_date, status } =
    req.body as Record<string, string | number>;

  if (!patient_id || !dentist_id || !treatment_id || !String(diagnosis || '').trim() || !start_date) {
    res.status(400).json({ error: 'Patient, dentist, treatment, diagnosis, and start date are required.' });
    return;
  }

  const db = getDb();
  const last = db.prepare('SELECT MAX(id) as maxId FROM treatment_plans').get() as { maxId: number | null };
  const plan_code = `PLN-${5001 + (last.maxId || 0)}`;
  const result = db.prepare(`
    INSERT INTO treatment_plans (
      plan_code, patient_id, dentist_id, treatment_id, diagnosis, treatment_notes, estimated_cost, start_date, status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    plan_code,
    Number(patient_id),
    Number(dentist_id),
    Number(treatment_id),
    String(diagnosis).trim(),
    String(treatment_notes || '').trim(),
    Number(estimated_cost || 0),
    String(start_date),
    String(status || 'Planned')
  );

  const created = db.prepare(`
    SELECT tp.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name, t.name as treatment_name
    FROM treatment_plans tp
    JOIN patients p ON p.id = tp.patient_id
    JOIN dentists d ON d.id = tp.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = tp.treatment_id
    WHERE tp.id = ?
  `).get(Number(result.lastInsertRowid));
  res.status(201).json({ plan: created });
});

router.put('/treatment-plans/:id', requireRole('Administrator', 'Dentist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM treatment_plans WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Treatment plan not found.' });
    return;
  }
  const { diagnosis, treatment_notes, estimated_cost, start_date, status } = req.body as Record<string, string | number>;
  db.prepare(`
    UPDATE treatment_plans SET
      diagnosis = ?, treatment_notes = ?, estimated_cost = ?, start_date = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(diagnosis ?? existing.diagnosis).trim(),
    String(treatment_notes ?? existing.treatment_notes ?? '').trim(),
    estimated_cost !== undefined ? Number(estimated_cost) : Number(existing.estimated_cost),
    String(start_date ?? existing.start_date),
    String(status ?? existing.status),
    id
  );
  const updated = db.prepare(`
    SELECT tp.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name, t.name as treatment_name
    FROM treatment_plans tp
    JOIN patients p ON p.id = tp.patient_id
    JOIN dentists d ON d.id = tp.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = tp.treatment_id
    WHERE tp.id = ?
  `).get(id);
  res.json({ plan: updated });
});

router.delete('/treatment-plans/:id', requireRole('Administrator', 'Dentist'), (req, res) => {
  const id = Number(req.params.id);
  getDb().prepare('DELETE FROM treatment_plans WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ============================================================================
// DENTAL EXAMINATION & HISTORY RECORDS
// ============================================================================
router.get('/dental-records', (req, res) => {
  const patientId = req.query.patient_id ? Number(req.query.patient_id) : null;
  const db = getDb();
  const baseSql = `
    SELECT dr.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name
    FROM dental_records dr
    JOIN patients p ON p.id = dr.patient_id
    JOIN dentists d ON d.id = dr.dentist_id
    JOIN staff s ON s.id = d.staff_id
  `;
  const records = patientId
    ? db.prepare(`${baseSql} WHERE dr.patient_id = ? ORDER BY dr.visit_date DESC, dr.id DESC`).all(patientId)
    : db.prepare(`${baseSql} ORDER BY dr.visit_date DESC, dr.id DESC`).all();
  res.json({ records });
});

router.post('/dental-records', requireRole('Administrator', 'Dentist'), (req, res) => {
  const {
    patient_id,
    dentist_id,
    visit_date,
    chief_complaint,
    examination_notes,
    diagnosis,
    tooth_area,
    treatment_recommendation,
    follow_up_date,
  } = req.body as Record<string, string | number>;

  if (
    !patient_id ||
    !dentist_id ||
    !visit_date ||
    !String(chief_complaint || '').trim() ||
    !String(examination_notes || '').trim() ||
    !String(diagnosis || '').trim() ||
    !String(tooth_area || '').trim()
  ) {
    res.status(400).json({ error: 'All clinical examination fields are required.' });
    return;
  }

  const db = getDb();
  const last = db.prepare('SELECT MAX(id) as maxId FROM dental_records').get() as { maxId: number | null };
  const record_code = `REC-${6001 + (last.maxId || 0)}`;
  const result = db.prepare(`
    INSERT INTO dental_records (
      record_code, patient_id, dentist_id, visit_date, chief_complaint, examination_notes,
      diagnosis, tooth_area, treatment_recommendation, follow_up_date, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    record_code,
    Number(patient_id),
    Number(dentist_id),
    String(visit_date),
    String(chief_complaint).trim(),
    String(examination_notes).trim(),
    String(diagnosis).trim(),
    String(tooth_area).trim(),
    String(treatment_recommendation || '').trim(),
    follow_up_date ? String(follow_up_date) : null
  );

  db.prepare(`UPDATE patients SET last_visit = ?, updated_at = datetime('now') WHERE id = ?`).run(
    String(visit_date),
    Number(patient_id)
  );

  const created = db.prepare(`
    SELECT dr.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name
    FROM dental_records dr
    JOIN patients p ON p.id = dr.patient_id
    JOIN dentists d ON d.id = dr.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE dr.id = ?
  `).get(Number(result.lastInsertRowid));
  res.status(201).json({ record: created });
});

router.delete('/dental-records/:id', requireRole('Administrator', 'Dentist'), (req, res) => {
  getDb().prepare('DELETE FROM dental_records WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// PRESCRIPTIONS
// ============================================================================
router.get('/prescriptions', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT rx.*, p.full_name as patient_name, p.patient_code, p.date_of_birth as patient_dob,
           p.phone as patient_phone, p.allergies as patient_allergies,
           s.full_name as dentist_name, d.specialization as dentist_specialization,
           d.license_number as dentist_license
    FROM prescriptions rx
    JOIN patients p ON p.id = rx.patient_id
    JOIN dentists d ON d.id = rx.dentist_id
    JOIN staff s ON s.id = d.staff_id
    ORDER BY rx.prescription_date DESC, rx.id DESC
  `).all() as Array<Record<string, unknown>>;

  const itemStmt = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?');
  const prescriptions = rows.map((r) => ({
    ...r,
    items: itemStmt.all(Number(r.id)),
  }));
  res.json({ prescriptions });
});

router.post('/prescriptions', requireRole('Administrator', 'Dentist'), (req, res) => {
  const { patient_id, dentist_id, prescription_date, additional_instructions, items } = req.body as {
    patient_id?: number;
    dentist_id?: number;
    prescription_date?: string;
    additional_instructions?: string;
    items?: Array<{ medication_name: string; dosage: string; frequency: string; duration: string }>;
  };

  if (!patient_id || !dentist_id || !prescription_date || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Patient, dentist, date, and at least one medication are required.' });
    return;
  }

  for (const item of items) {
    if (!item.medication_name?.trim() || !item.dosage?.trim() || !item.frequency?.trim() || !item.duration?.trim()) {
      res.status(400).json({ error: 'Every medication item must include name, dosage, frequency, and duration.' });
      return;
    }
  }

  const db = getDb();
  const last = db.prepare('SELECT MAX(id) as maxId FROM prescriptions').get() as { maxId: number | null };
  const prescription_code = `RX-${7001 + (last.maxId || 0)}`;

  db.exec('BEGIN TRANSACTION;');
  try {
    const rxRes = db.prepare(`
      INSERT INTO prescriptions (prescription_code, patient_id, dentist_id, prescription_date, additional_instructions, is_demo)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(prescription_code, Number(patient_id), Number(dentist_id), prescription_date, (additional_instructions || '').trim());
    const rxId = Number(rxRes.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItem.run(rxId, item.medication_name.trim(), item.dosage.trim(), item.frequency.trim(), item.duration.trim());
    }
    db.exec('COMMIT;');

    const created = db.prepare(`
      SELECT rx.*, p.full_name as patient_name, p.patient_code, p.date_of_birth as patient_dob,
             p.phone as patient_phone, p.allergies as patient_allergies,
             s.full_name as dentist_name, d.specialization as dentist_specialization,
             d.license_number as dentist_license
      FROM prescriptions rx
      JOIN patients p ON p.id = rx.patient_id
      JOIN dentists d ON d.id = rx.dentist_id
      JOIN staff s ON s.id = d.staff_id
      WHERE rx.id = ?
    `).get(rxId) as Record<string, unknown>;
    const createdItems = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rxId);
    res.status(201).json({ prescription: { ...created, items: createdItems } });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to save prescription.' });
  }
});

router.put('/prescriptions/:id', requireRole('Administrator', 'Dentist'), (req, res) => {
  const id = Number(req.params.id);
  const { patient_id, dentist_id, prescription_date, additional_instructions, items } = req.body as {
    patient_id?: number;
    dentist_id?: number;
    prescription_date?: string;
    additional_instructions?: string;
    items?: Array<{ medication_name: string; dosage: string; frequency: string; duration: string }>;
  };

  if (!patient_id || !dentist_id || !prescription_date || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Patient, dentist, date, and at least one medication are required.' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM prescriptions WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Prescription not found.' });
    return;
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE prescriptions SET
        patient_id = ?, dentist_id = ?, prescription_date = ?, additional_instructions = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(Number(patient_id), Number(dentist_id), prescription_date, (additional_instructions || '').trim(), id);

    db.prepare('DELETE FROM prescription_items WHERE prescription_id = ?').run(id);
    const insertItem = db.prepare(`
      INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItem.run(id, item.medication_name.trim(), item.dosage.trim(), item.frequency.trim(), item.duration.trim());
    }
    db.exec('COMMIT;');

    const updated = db.prepare(`
      SELECT rx.*, p.full_name as patient_name, p.patient_code, p.date_of_birth as patient_dob,
             p.phone as patient_phone, p.allergies as patient_allergies,
             s.full_name as dentist_name, d.specialization as dentist_specialization,
             d.license_number as dentist_license
      FROM prescriptions rx
      JOIN patients p ON p.id = rx.patient_id
      JOIN dentists d ON d.id = rx.dentist_id
      JOIN staff s ON s.id = d.staff_id
      WHERE rx.id = ?
    `).get(id) as Record<string, unknown>;
    const updatedItems = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(id);
    res.json({ prescription: { ...updated, items: updatedItems } });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update prescription.' });
  }
});

router.delete('/prescriptions/:id', requireRole('Administrator', 'Dentist'), (req, res) => {
  getDb().prepare('DELETE FROM prescriptions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
