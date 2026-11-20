import { Router } from 'express';
import { getDb, getTodayIso } from '../db/database.ts';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth, verifyCsrf);

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM patients ORDER BY id DESC
  `).all() as Array<Record<string, unknown>>;

  const enriched = rows.map((r) => ({
    ...r,
    age: calculateAge(String(r.date_of_birth || '')),
  }));
  res.json({ patients: enriched });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const appointments = db.prepare(`
    SELECT a.*, t.name as treatment_name, s.full_name as dentist_name
    FROM appointments a
    JOIN treatments t ON t.id = a.treatment_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE a.patient_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(id);

  const dental_records = db.prepare(`
    SELECT dr.*, s.full_name as dentist_name
    FROM dental_records dr
    JOIN dentists d ON d.id = dr.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE dr.patient_id = ?
    ORDER BY dr.visit_date DESC, dr.id DESC
  `).all(id);

  const treatment_plans = db.prepare(`
    SELECT tp.*, t.name as treatment_name, s.full_name as dentist_name
    FROM treatment_plans tp
    JOIN treatments t ON t.id = tp.treatment_id
    JOIN dentists d ON d.id = tp.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE tp.patient_id = ?
    ORDER BY tp.start_date DESC, tp.id DESC
  `).all(id);

  const prescriptions = db.prepare(`
    SELECT rx.*, s.full_name as dentist_name, d.specialization as dentist_specialization
    FROM prescriptions rx
    JOIN dentists d ON d.id = rx.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE rx.patient_id = ?
    ORDER BY rx.prescription_date DESC, rx.id DESC
  `).all(id) as Array<Record<string, unknown>>;

  const rxItemsStmt = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?');
  const enrichedRx = prescriptions.map((rx) => ({
    ...rx,
    items: rxItemsStmt.all(Number(rx.id)),
  }));

  const invoices = db.prepare(`
    SELECT * FROM invoices WHERE patient_id = ? ORDER BY invoice_date DESC, id DESC
  `).all(id) as Array<Record<string, unknown>>;

  const invItemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
  const paymentsStmt = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC');
  const enrichedInvoices = invoices.map((inv) => ({
    ...inv,
    balance: Number((Number(inv.total) - Number(inv.amount_paid)).toFixed(2)),
    items: invItemsStmt.all(Number(inv.id)),
    payments: paymentsStmt.all(Number(inv.id)),
  }));

  const follow_ups = db.prepare(`
    SELECT f.*, s.full_name as dentist_name
    FROM follow_ups f
    JOIN dentists d ON d.id = f.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE f.patient_id = ?
    ORDER BY f.follow_up_date DESC
  `).all(id);

  res.json({
    patient: {
      ...patient,
      age: calculateAge(String(patient.date_of_birth || '')),
    },
    appointments,
    dental_records,
    treatment_plans,
    prescriptions: enrichedRx,
    invoices: enrichedInvoices,
    follow_ups,
  });
});

router.post('/', requireRole('Administrator', 'Receptionist', 'Dentist'), (req, res) => {
  const {
    full_name,
    date_of_birth,
    gender,
    phone,
    email,
    address,
    emergency_contact,
    medical_history,
    allergies,
    notes,
    status,
  } = req.body as Record<string, string>;

  if (!full_name?.trim() || !date_of_birth || !gender || !phone?.trim() || !email?.trim() || !address?.trim() || !emergency_contact?.trim()) {
    res.status(400).json({ error: 'All required patient fields must be provided.' });
    return;
  }

  const db = getDb();
  const duplicate = db.prepare('SELECT id FROM patients WHERE LOWER(email) = LOWER(?) OR phone = ?').get(email.trim(), phone.trim());
  if (duplicate) {
    res.status(409).json({ error: 'A patient with this email address or phone number already exists.' });
    return;
  }

  const lastRow = db.prepare('SELECT MAX(id) as maxId FROM patients').get() as { maxId: number | null };
  const nextNum = 1001 + (lastRow.maxId || 0);
  const patient_code = `PAT-${nextNum}`;

  const result = db.prepare(`
    INSERT INTO patients (
      patient_code, full_name, date_of_birth, gender, phone, email, address,
      emergency_contact, medical_history, allergies, notes, registration_date, last_visit, status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0)
  `).run(
    patient_code,
    full_name.trim(),
    date_of_birth,
    gender,
    phone.trim(),
    email.trim().toLowerCase(),
    address.trim(),
    emergency_contact.trim(),
    (medical_history || '').trim(),
    (allergies || '').trim(),
    (notes || '').trim(),
    getTodayIso(),
    status === 'Inactive' ? 'Inactive' : 'Active'
  );

  const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  res.status(201).json({
    patient: { ...created, age: calculateAge(String(created.date_of_birth)) },
  });
});

router.put('/:id', requireRole('Administrator', 'Receptionist', 'Dentist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const {
    full_name,
    date_of_birth,
    gender,
    phone,
    email,
    address,
    emergency_contact,
    medical_history,
    allergies,
    notes,
    status,
  } = req.body as Record<string, string>;

  if (!full_name?.trim() || !date_of_birth || !gender || !phone?.trim() || !email?.trim() || !address?.trim() || !emergency_contact?.trim()) {
    res.status(400).json({ error: 'All required patient fields must be provided.' });
    return;
  }

  const duplicate = db
    .prepare('SELECT id FROM patients WHERE (LOWER(email) = LOWER(?) OR phone = ?) AND id != ?')
    .get(email.trim(), phone.trim(), id);
  if (duplicate) {
    res.status(409).json({ error: 'Another patient already uses this email or phone number.' });
    return;
  }

  db.prepare(`
    UPDATE patients SET
      full_name = ?, date_of_birth = ?, gender = ?, phone = ?, email = ?, address = ?,
      emergency_contact = ?, medical_history = ?, allergies = ?, notes = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    full_name.trim(),
    date_of_birth,
    gender,
    phone.trim(),
    email.trim().toLowerCase(),
    address.trim(),
    emergency_contact.trim(),
    (medical_history || '').trim(),
    (allergies || '').trim(),
    (notes || '').trim(),
    status === 'Inactive' ? 'Inactive' : 'Active',
    id
  );

  const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ patient: { ...updated, age: calculateAge(String(updated.date_of_birth)) } });
});

router.delete('/:id', requireRole('Administrator', 'Receptionist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT id FROM patients WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  db.prepare('DELETE FROM patients WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
