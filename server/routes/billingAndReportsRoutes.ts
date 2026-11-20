import { Router } from 'express';
import { getDb, getTodayIso } from '../db/database.ts';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.ts';
import { buildProjectZip } from '../utils/zipBuilder.ts';

const router = Router();
router.use(requireAuth, verifyCsrf);

// ============================================================================
// DASHBOARD OVERVIEW & CHART.JS SERIES
// ============================================================================
router.get('/dashboard', (_req, res) => {
  const db = getDb();
  const today = getTodayIso();

  const totalPatients = (db.prepare('SELECT COUNT(*) as c FROM patients').get() as { c: number }).c;
  const todaysAppointmentsCount = (
    db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE appointment_date = ? AND status != 'Cancelled'`).get(today) as {
      c: number;
    }
  ).c;
  const totalDentists = (
    db.prepare(`SELECT COUNT(*) as c FROM staff WHERE role = 'Dentist' AND status = 'Active'`).get() as { c: number }
  ).c;

  const monthlyRevenueRow = db
    .prepare(`SELECT COALESCE(SUM(amount_paid), 0) as rev FROM invoices WHERE substr(invoice_date, 1, 7) = ?`)
    .get(today.slice(0, 7)) as { rev: number };
  const totalRevenueRow = db.prepare(`SELECT COALESCE(SUM(amount_paid), 0) as rev FROM invoices`).get() as { rev: number };

  const todaysAppointments = db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name, t.name as treatment_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = a.treatment_id
    WHERE a.appointment_date = ?
    ORDER BY a.appointment_time ASC
  `).all(today);

  const upcomingAppointments = db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.patient_code, s.full_name as dentist_name, t.name as treatment_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN staff s ON s.id = d.staff_id
    JOIN treatments t ON t.id = a.treatment_id
    WHERE a.appointment_date > ? AND a.status IN ('Scheduled', 'Confirmed')
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
    LIMIT 6
  `).all(today);

  const recentPatients = db.prepare(`
    SELECT id, patient_code, full_name, phone, registration_date, last_visit, status, is_demo
    FROM patients ORDER BY id DESC LIMIT 5
  `).all();

  const recentTransactions = db.prepare(`
    SELECT p.id, p.payment_date, p.amount, p.payment_method, i.invoice_number, pt.full_name as patient_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN patients pt ON pt.id = i.patient_id
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT 5
  `).all();

  const upcomingFollowUps = db.prepare(`
    SELECT f.*, pt.full_name as patient_name, pt.patient_code, s.full_name as dentist_name
    FROM follow_ups f
    JOIN patients pt ON pt.id = f.patient_id
    JOIN dentists d ON d.id = f.dentist_id
    JOIN staff s ON s.id = d.staff_id
    WHERE f.status = 'Pending'
    ORDER BY f.follow_up_date ASC
    LIMIT 5
  `).all();

  const statusRows = db.prepare(`
    SELECT status, COUNT(*) as count FROM appointments GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  // Build 6-month chart series grounded in real database rows + historical baseline
  const months: string[] = [];
  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(d.toISOString().slice(0, 7));
    months.push(d.toLocaleDateString('en-US', { month: 'short' }));
  }

  const revenueSeries = monthKeys.map((mk) => {
    const r = db
      .prepare(`SELECT COALESCE(SUM(amount_paid), 0) as sum FROM invoices WHERE substr(invoice_date, 1, 7) = ?`)
      .get(mk) as { sum: number };
    return Number(r.sum.toFixed(2));
  });

  const patientGrowthSeries = monthKeys.map((mk) => {
    const r = db
      .prepare(`SELECT COUNT(*) as c FROM patients WHERE substr(registration_date, 1, 7) <= ?`)
      .get(mk) as { c: number };
    return r.c;
  });

  const apptByDentist = db.prepare(`
    SELECT s.full_name as dentist_name, COUNT(a.id) as count
    FROM dentists d
    JOIN staff s ON s.id = d.staff_id
    LEFT JOIN appointments a ON a.dentist_id = d.id
    GROUP BY d.id, s.full_name
    ORDER BY count DESC
  `).all();

  res.json({
    stats: {
      totalPatients,
      todaysAppointmentsCount,
      totalDentists,
      monthlyRevenue: Number(monthlyRevenueRow.rev.toFixed(2)),
      totalCollectedRevenue: Number(totalRevenueRow.rev.toFixed(2)),
    },
    todaysAppointments,
    upcomingAppointments,
    recentPatients,
    recentTransactions,
    upcomingFollowUps,
    charts: {
      months,
      revenueSeries,
      patientGrowthSeries,
      statusDistribution: statusRows,
      apptByDentist,
    },
  });
});

// ============================================================================
// BILLING: INVOICES & PAYMENTS
// ============================================================================
router.get('/invoices', requireRole('Administrator', 'Receptionist', 'Dentist'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, p.full_name as patient_name, p.patient_code, p.phone as patient_phone, p.email as patient_email
    FROM invoices i
    JOIN patients p ON p.id = i.patient_id
    ORDER BY i.invoice_date DESC, i.id DESC
  `).all() as Array<Record<string, unknown>>;

  const itemStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
  const payStmt = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, id DESC');

  const invoices = rows.map((inv) => ({
    ...inv,
    balance: Number(Math.max(0, Number(inv.total) - Number(inv.amount_paid)).toFixed(2)),
    items: itemStmt.all(Number(inv.id)),
    payments: payStmt.all(Number(inv.id)),
  }));

  res.json({ invoices });
});

router.post('/invoices', requireRole('Administrator', 'Receptionist'), (req, res) => {
  const { patient_id, invoice_date, discount, tax_rate, notes, items, initial_payment } = req.body as {
    patient_id?: number;
    invoice_date?: string;
    discount?: number;
    tax_rate?: number;
    notes?: string;
    items?: Array<{ treatment_id?: number | null; description: string; quantity: number; unit_price: number }>;
    initial_payment?: { amount: number; payment_method: string; reference_number?: string };
  };

  if (!patient_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Patient, invoice date, and at least one line item are required.' });
    return;
  }

  let subtotal = 0;
  for (const item of items) {
    if (!item.description?.trim() || Number(item.quantity) <= 0 || Number(item.unit_price) < 0) {
      res.status(400).json({ error: 'Each line item requires a description, positive quantity, and valid price.' });
      return;
    }
    subtotal += Number(item.quantity) * Number(item.unit_price);
  }

  const cleanDiscount = Math.max(0, Math.min(subtotal, Number(discount || 0)));
  const rate = Math.max(0, Number(tax_rate ?? 5)) / 100;
  const tax_amount = Number(((subtotal - cleanDiscount) * rate).toFixed(2));
  const total = Number((subtotal - cleanDiscount + tax_amount).toFixed(2));
  const paid = Math.max(0, Math.min(total, Number(initial_payment?.amount || 0)));
  const payment_status = paid >= total ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending';

  const db = getDb();
  const last = db.prepare('SELECT MAX(id) as maxId FROM invoices').get() as { maxId: number | null };
  const invoice_number = `INV-${8001 + (last.maxId || 0)}`;

  db.exec('BEGIN TRANSACTION;');
  try {
    const invRes = db.prepare(`
      INSERT INTO invoices (
        invoice_number, patient_id, invoice_date, subtotal, discount, tax_amount, total, amount_paid, payment_status, notes, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      invoice_number,
      Number(patient_id),
      invoice_date,
      Number(subtotal.toFixed(2)),
      cleanDiscount,
      tax_amount,
      total,
      paid,
      payment_status,
      (notes || '').trim()
    );
    const invId = Number(invRes.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, treatment_id, description, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      insertItem.run(invId, item.treatment_id || null, item.description.trim(), qty, price, Number((qty * price).toFixed(2)));
    }

    if (paid > 0) {
      db.prepare(`
        INSERT INTO payments (invoice_id, payment_date, amount, payment_method, reference_number, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        invId,
        invoice_date,
        paid,
        initial_payment?.payment_method || 'Card',
        initial_payment?.reference_number || '',
        'Initial payment at invoice creation'
      );
    }

    if (payment_status !== 'Paid') {
      const pat = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(Number(patient_id)) as { full_name: string } | undefined;
      db.prepare(`
        INSERT INTO notifications (target_role, title, message, category, is_read, related_link)
        VALUES ('Receptionist', ?, ?, 'payment', 0, 'billing')
      `).run(
        'Payment Reminder',
        `Invoice ${invoice_number} for ${pat?.full_name || 'Patient'} has a balance of $${(total - paid).toFixed(2)}.`
      );
    }

    db.exec('COMMIT;');

    const created = db.prepare(`
      SELECT i.*, p.full_name as patient_name, p.patient_code, p.phone as patient_phone, p.email as patient_email
      FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.id = ?
    `).get(invId) as Record<string, unknown>;
    res.status(201).json({
      invoice: {
        ...created,
        balance: Number((total - paid).toFixed(2)),
        items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invId),
        payments: db.prepare('SELECT * FROM payments WHERE invoice_id = ?').all(invId),
      },
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create invoice.' });
  }
});

router.put('/invoices/:id', requireRole('Administrator', 'Receptionist'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }

  const { invoice_date, discount, tax_rate, notes, items } = req.body as {
    invoice_date?: string;
    discount?: number;
    tax_rate?: number;
    notes?: string;
    items?: Array<{ treatment_id?: number | null; description: string; quantity: number; unit_price: number }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one line item is required.' });
    return;
  }

  let subtotal = 0;
  for (const item of items) {
    subtotal += Number(item.quantity) * Number(item.unit_price);
  }
  const cleanDiscount = Math.max(0, Math.min(subtotal, Number(discount ?? existing.discount)));
  const rate = Math.max(0, Number(tax_rate ?? 5)) / 100;
  const tax_amount = Number(((subtotal - cleanDiscount) * rate).toFixed(2));
  const total = Number((subtotal - cleanDiscount + tax_amount).toFixed(2));
  const amount_paid = Number(existing.amount_paid);
  const payment_status = amount_paid >= total ? 'Paid' : amount_paid > 0 ? 'Partially Paid' : 'Pending';

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE invoices SET
        invoice_date = ?, subtotal = ?, discount = ?, tax_amount = ?, total = ?, payment_status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      invoice_date || String(existing.invoice_date),
      Number(subtotal.toFixed(2)),
      cleanDiscount,
      tax_amount,
      total,
      payment_status,
      (notes ?? String(existing.notes || '')).trim(),
      id
    );

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, treatment_id, description, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      insertItem.run(id, item.treatment_id || null, item.description.trim(), qty, price, Number((qty * price).toFixed(2)));
    }
    db.exec('COMMIT;');

    const updated = db.prepare(`
      SELECT i.*, p.full_name as patient_name, p.patient_code, p.phone as patient_phone, p.email as patient_email
      FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.id = ?
    `).get(id) as Record<string, unknown>;
    res.json({
      invoice: {
        ...updated,
        balance: Number(Math.max(0, total - amount_paid).toFixed(2)),
        items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id),
        payments: db.prepare('SELECT * FROM payments WHERE invoice_id = ?').all(id),
      },
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update invoice.' });
  }
});

router.post('/invoices/:id/payments', requireRole('Administrator', 'Receptionist'), (req, res) => {
  const id = Number(req.params.id);
  const { amount, payment_method, payment_date, reference_number, notes } = req.body as {
    amount?: number;
    payment_method?: string;
    payment_date?: string;
    reference_number?: string;
    notes?: string;
  };

  const payAmt = Number(amount);
  if (!payAmt || payAmt <= 0 || !payment_method) {
    res.status(400).json({ error: 'Positive payment amount and payment method are required.' });
    return;
  }

  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as
    | { id: number; total: number; amount_paid: number; invoice_number: string }
    | undefined;
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }

  const remaining = Number((inv.total - inv.amount_paid).toFixed(2));
  if (payAmt > remaining + 0.01) {
    res.status(400).json({ error: `Payment exceeds remaining balance ($${remaining.toFixed(2)}).` });
    return;
  }

  const newPaid = Number(Math.min(inv.total, inv.amount_paid + payAmt).toFixed(2));
  const nextStatus = newPaid >= inv.total ? 'Paid' : 'Partially Paid';

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO payments (invoice_id, payment_date, amount, payment_method, reference_number, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, payment_date || getTodayIso(), payAmt, payment_method, (reference_number || '').trim(), (notes || '').trim());

    db.prepare(`
      UPDATE invoices SET amount_paid = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newPaid, nextStatus, id);
    db.exec('COMMIT;');

    const updated = db.prepare(`
      SELECT i.*, p.full_name as patient_name, p.patient_code, p.phone as patient_phone, p.email as patient_email
      FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.id = ?
    `).get(id) as Record<string, unknown>;
    res.json({
      invoice: {
        ...updated,
        balance: Number(Math.max(0, inv.total - newPaid).toFixed(2)),
        items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id),
        payments: db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC').all(id),
      },
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to record payment.' });
  }
});

router.delete('/invoices/:id', requireRole('Administrator', 'Receptionist'), (req, res) => {
  getDb().prepare('DELETE FROM invoices WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ============================================================================
// REPORTS & ANALYTICS
// ============================================================================
router.get('/reports', requireRole('Administrator', 'Dentist', 'Receptionist'), (req, res) => {
  const from = String(req.query.from || '2000-01-01');
  const to = String(req.query.to || '2099-12-31');
  const db = getDb();

  const totalPatients = (db.prepare('SELECT COUNT(*) as c FROM patients').get() as { c: number }).c;
  const newPatientsInRange = (
    db.prepare(`SELECT COUNT(*) as c FROM patients WHERE registration_date BETWEEN ? AND ?`).get(from, to) as { c: number }
  ).c;

  const apptsSummary = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'No-show' THEN 1 ELSE 0 END) as no_show,
      SUM(CASE WHEN status IN ('Scheduled', 'Confirmed') THEN 1 ELSE 0 END) as active
    FROM appointments
    WHERE appointment_date BETWEEN ? AND ?
  `).get(from, to) as Record<string, number>;

  const revenueSummary = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as billed,
      COALESCE(SUM(amount_paid), 0) as collected,
      COALESCE(SUM(total - amount_paid), 0) as outstanding
    FROM invoices
    WHERE invoice_date BETWEEN ? AND ?
  `).get(from, to) as Record<string, number>;

  const treatmentRevenue = db.prepare(`
    SELECT COALESCE(t.name, ii.description) as treatment_name,
           SUM(ii.quantity) as total_qty,
           SUM(ii.line_total) as revenue
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    LEFT JOIN treatments t ON t.id = ii.treatment_id
    WHERE i.invoice_date BETWEEN ? AND ?
    GROUP BY COALESCE(t.name, ii.description)
    ORDER BY revenue DESC
  `).all(from, to);

  const dentistAppointments = db.prepare(`
    SELECT s.full_name as dentist_name, d.specialization,
           COUNT(a.id) as total,
           SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN a.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN a.status = 'No-show' THEN 1 ELSE 0 END) as no_show
    FROM dentists d
    JOIN staff s ON s.id = d.staff_id
    LEFT JOIN appointments a ON a.dentist_id = d.id AND a.appointment_date BETWEEN ? AND ?
    GROUP BY d.id, s.full_name, d.specialization
    ORDER BY total DESC
  `).all(from, to);

  const monthlyPatients = db.prepare(`
    SELECT substr(registration_date, 1, 7) as month, COUNT(*) as count
    FROM patients
    WHERE registration_date BETWEEN ? AND ?
    GROUP BY substr(registration_date, 1, 7)
    ORDER BY month ASC
  `).all(from, to);

  const monthlyRevenue = db.prepare(`
    SELECT substr(invoice_date, 1, 7) as month, SUM(amount_paid) as collected, SUM(total) as billed
    FROM invoices
    WHERE invoice_date BETWEEN ? AND ?
    GROUP BY substr(invoice_date, 1, 7)
    ORDER BY month ASC
  `).all(from, to);

  res.json({
    range: { from, to },
    summary: {
      totalPatients,
      newPatientsInRange,
      appointments: apptsSummary,
      revenue: revenueSummary,
    },
    treatmentRevenue,
    dentistAppointments,
    monthlyPatients,
    monthlyRevenue,
  });
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================
router.get('/notifications', (req, res) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE target_role IS NULL OR target_role = ?
    ORDER BY is_read ASC, id DESC
    LIMIT 25
  `).all(req.user!.role);
  res.json({ notifications });
});

router.put('/notifications/:id/read', (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

router.put('/notifications/read-all', (_req, res) => {
  getDb().prepare('UPDATE notifications SET is_read = 1').run();
  res.json({ ok: true });
});

// ============================================================================
// SETTINGS & ADMIN BACKUP
// ============================================================================
router.get('/settings', (_req, res) => {
  const settings = getDb().prepare('SELECT * FROM clinic_settings WHERE id = 1').get();
  res.json({ settings });
});

router.put('/settings', requireRole('Administrator'), (req, res) => {
  const { clinic_name, address, phone, email, working_hours, tax_rate, currency, logo_url } = req.body as Record<string, string | number>;
  if (!String(clinic_name || '').trim() || !String(address || '').trim() || !String(phone || '').trim() || !String(email || '').trim()) {
    res.status(400).json({ error: 'Clinic name, address, phone, and email are required.' });
    return;
  }

  const db = getDb();
  db.prepare(`
    UPDATE clinic_settings SET
      clinic_name = ?, address = ?, phone = ?, email = ?, working_hours = ?, tax_rate = ?, currency = ?, logo_url = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(
    String(clinic_name).trim(),
    String(address).trim(),
    String(phone).trim(),
    String(email).trim(),
    String(working_hours || '').trim(),
    Number(tax_rate ?? 5),
    String(currency || 'USD'),
    logo_url ? String(logo_url) : ''
  );

  const settings = db.prepare('SELECT * FROM clinic_settings WHERE id = 1').get();
  res.json({ settings });
});

router.get('/backup', requireRole('Administrator'), (_req, res) => {
  const db = getDb();
  const payload = {
    exported_at: new Date().toISOString(),
    clinic_settings: db.prepare('SELECT * FROM clinic_settings').all(),
    patients: db.prepare('SELECT * FROM patients').all(),
    staff: db.prepare('SELECT * FROM staff').all(),
    dentists: db.prepare('SELECT * FROM dentists').all(),
    treatments: db.prepare('SELECT * FROM treatments').all(),
    appointments: db.prepare('SELECT * FROM appointments').all(),
    treatment_plans: db.prepare('SELECT * FROM treatment_plans').all(),
    dental_records: db.prepare('SELECT * FROM dental_records').all(),
    prescriptions: db.prepare('SELECT * FROM prescriptions').all(),
    prescription_items: db.prepare('SELECT * FROM prescription_items').all(),
    invoices: db.prepare('SELECT * FROM invoices').all(),
    invoice_items: db.prepare('SELECT * FROM invoice_items').all(),
    payments: db.prepare('SELECT * FROM payments').all(),
    follow_ups: db.prepare('SELECT * FROM follow_ups').all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="claritydental-backup-${getTodayIso()}.json"`);
  res.json(payload);
});

router.get('/export-source', requireRole('Administrator'), (_req, res) => {
  const zipBuffer = buildProjectZip(process.cwd());
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="claritydental-dcms-source.zip"');
  res.setHeader('Content-Length', String(zipBuffer.length));
  res.send(zipBuffer);
});

export default router;
