import bcrypt from 'bcryptjs';
import { getDb } from './database.ts';

function dateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function seedDemoData(): void {
  const db = getDb();

  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    return;
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Clinic Settings
    db.prepare(`
      INSERT INTO clinic_settings (clinic_name, address, phone, email, working_hours, tax_rate, currency, logo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ClarityDental Studio',
      '420 Mercer Street, Suite 310, Seattle, WA 98109',
      '(206) 555-0184',
      'care@claritydental.example.com',
      'Mon–Fri 08:30 AM – 06:00 PM · Sat 09:00 AM – 02:00 PM',
      5.0,
      'USD',
      ''
    );

    // 2. Users (Demo Credentials hashed with bcrypt)
    const adminHash = bcrypt.hashSync('Admin@123', 10);
    const dentistHash = bcrypt.hashSync('Dentist@123', 10);
    const receptionHash = bcrypt.hashSync('Reception@123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const adminUser = insertUser.run('admin', 'admin@claritydental.example.com', adminHash, 'Claire Donovan', 'Administrator', null);
    const d1User = insertUser.run('elena.vance', 'elena.vance@claritydental.example.com', dentistHash, 'Dr. Elena Vance', 'Dentist', '/src/assets/images/dentist_elena_vance_1795166175029.jpg');
    const d2User = insertUser.run('marcus.chen', 'marcus.chen@claritydental.example.com', dentistHash, 'Dr. Marcus Chen', 'Dentist', '/src/assets/images/dentist_marcus_chen_1795166175053.jpg');
    const d3User = insertUser.run('sarah.alvarez', 'sarah.alvarez@claritydental.example.com', dentistHash, 'Dr. Sarah Alvarez', 'Dentist', '/src/assets/images/dentist_sarah_alvarez_1795166175371.jpg');
    const d4User = insertUser.run('david.okafor', 'david.okafor@claritydental.example.com', dentistHash, 'Dr. David Okafor', 'Dentist', '/src/assets/images/dentist_david_okafor_1795166175382.jpg');
    const r1User = insertUser.run('reception', 'reception@claritydental.example.com', receptionHash, 'Hannah Brooks', 'Receptionist', null);
    const r2User = insertUser.run('liam.patel', 'liam.patel@claritydental.example.com', receptionHash, 'Liam Patel', 'Receptionist', null);
    const r3User = insertUser.run('nina.kovacs', 'nina.kovacs@claritydental.example.com', receptionHash, 'Nina Kovacs', 'Receptionist', null);

    // 3. Staff (1 Admin, 4 Dentists, 3 Receptionists)
    const insertStaff = db.prepare(`
      INSERT INTO staff (staff_code, user_id, full_name, role, phone, email, working_hours, avatar_url, status, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertStaff.run('STF-2000', Number(adminUser.lastInsertRowid), 'Claire Donovan', 'Administrator', '(206) 555-0100', 'admin@claritydental.example.com', 'Mon–Fri 08:30–17:30', null, 'Active');
    const sD1 = insertStaff.run('STF-2001', Number(d1User.lastInsertRowid), 'Dr. Elena Vance', 'Dentist', '(206) 555-0111', 'elena.vance@claritydental.example.com', 'Mon–Fri 09:00–17:00', '/src/assets/images/dentist_elena_vance_1795166175029.jpg', 'Active');
    const sD2 = insertStaff.run('STF-2002', Number(d2User.lastInsertRowid), 'Dr. Marcus Chen', 'Dentist', '(206) 555-0112', 'marcus.chen@claritydental.example.com', 'Mon–Fri 08:30–16:30', '/src/assets/images/dentist_marcus_chen_1795166175053.jpg', 'Active');
    const sD3 = insertStaff.run('STF-2003', Number(d3User.lastInsertRowid), 'Dr. Sarah Alvarez', 'Dentist', '(206) 555-0113', 'sarah.alvarez@claritydental.example.com', 'Tue–Sat 09:00–17:00', '/src/assets/images/dentist_sarah_alvarez_1795166175371.jpg', 'Active');
    const sD4 = insertStaff.run('STF-2004', Number(d4User.lastInsertRowid), 'Dr. David Okafor', 'Dentist', '(206) 555-0114', 'david.okafor@claritydental.example.com', 'Mon–Thu 09:30–18:00', '/src/assets/images/dentist_david_okafor_1795166175382.jpg', 'Active');

    insertStaff.run('STF-2005', Number(r1User.lastInsertRowid), 'Hannah Brooks', 'Receptionist', '(206) 555-0121', 'reception@claritydental.example.com', 'Mon–Fri 08:00–16:30', null, 'Active');
    insertStaff.run('STF-2006', Number(r2User.lastInsertRowid), 'Liam Patel', 'Receptionist', '(206) 555-0122', 'liam.patel@claritydental.example.com', 'Mon–Fri 10:00–18:30', null, 'Active');
    insertStaff.run('STF-2007', Number(r3User.lastInsertRowid), 'Nina Kovacs', 'Receptionist', '(206) 555-0123', 'nina.kovacs@claritydental.example.com', 'Tue–Sat 08:30–16:30', null, 'Active');

    // 4. Dentists
    const insertDentist = db.prepare(`
      INSERT INTO dentists (staff_id, specialization, license_number, bio, available_days, start_hour, end_hour)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const den1 = Number(insertDentist.run(Number(sD1.lastInsertRowid), 'General & Restorative Dentistry', 'DDS-WA-44812', 'Lead restorative clinician specializing in biomimetic composite restorations and preventive prosthodontics.', 'Mon,Tue,Wed,Thu,Fri', '09:00', '17:00').lastInsertRowid);
    const den2 = Number(insertDentist.run(Number(sD2.lastInsertRowid), 'Endodontics', 'DDS-WA-39204', 'Microscope-assisted root canal therapy, retreatment procedures, and acute dental pain management.', 'Mon,Tue,Wed,Thu,Fri', '08:30', '16:30').lastInsertRowid);
    const den3 = Number(insertDentist.run(Number(sD3.lastInsertRowid), 'Orthodontics', 'DDS-WA-51093', 'Clear aligner biomechanics, adolescent arch development, and functional bite alignment.', 'Tue,Wed,Thu,Fri,Sat', '09:00', '17:00').lastInsertRowid);
    const den4 = Number(insertDentist.run(Number(sD4.lastInsertRowid), 'Oral & Maxillofacial Surgery', 'DDS-WA-47621', 'Impacted third molar extractions, bone grafting, and single-tooth implant placement.', 'Mon,Tue,Wed,Thu', '09:30', '18:00').lastInsertRowid);

    // 5. 10 Treatments
    const insertTreatment = db.prepare(`
      INSERT INTO treatments (treatment_code, name, description, duration_minutes, cost, status, is_demo)
      VALUES (?, ?, ?, ?, ?, 'Active', 1)
    `);
    const treatmentsData = [
      ['TRT-3001', 'Dental Consultation', 'Comprehensive oral exam, periodontal charting, and digital bitewing review.', 30, 95],
      ['TRT-3002', 'Teeth Cleaning', 'Ultrasonic scaling, subgingival prophylaxis, and enamel polishing.', 45, 140],
      ['TRT-3003', 'Tooth Extraction', 'Atraumatic simple or surgical extraction with local anesthesia.', 45, 240],
      ['TRT-3004', 'Root Canal Treatment', 'Endodontic canal shaping, disinfection, and warm gutta-percha obturation.', 75, 890],
      ['TRT-3005', 'Dental Filling', 'Direct bonded composite resin restoration matched to natural enamel shade.', 45, 210],
      ['TRT-3006', 'Teeth Whitening', 'In-clinic desensitizing peroxide whitening session with gingival barrier.', 60, 420],
      ['TRT-3007', 'Dental Crown', 'Custom milled lithium disilicate full-coverage crown preparation and cementation.', 60, 1150],
      ['TRT-3008', 'Braces Consultation', '3D intraoral scan, cephalometric evaluation, and orthodontic alignment plan.', 45, 120],
      ['TRT-3009', 'Periodontal Scaling', 'Quadrant scaling and root planing for active periodontal pocket management.', 60, 310],
      ['TRT-3010', 'Implant Assessment', 'CBCT bone volume review and surgical guide planning for dental implant.', 45, 180],
    ] as const;

    const trtIds: number[] = [];
    for (const t of treatmentsData) {
      trtIds.push(Number(insertTreatment.run(t[0], t[1], t[2], t[3], t[4]).lastInsertRowid));
    }

    // 6. 15 Fictional Patients
    const insertPatient = db.prepare(`
      INSERT INTO patients (
        patient_code, full_name, date_of_birth, gender, phone, email, address,
        emergency_contact, medical_history, allergies, notes, registration_date, last_visit, status, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const patientsData = [
      ['PAT-1001', 'Maria Santos', '1988-04-14', 'Female', '(206) 555-1401', 'maria.santos@demo.example.com', '118 Pinehurst Ave, Seattle, WA', 'Carlos Santos (206) 555-9401', 'Mild seasonal rhinitis', 'Penicillin', 'Prefers morning appointments.', dateOffset(-240), dateOffset(-12), 'Active'],
      ['PAT-1002', 'Arthur Pendelton', '1965-09-22', 'Male', '(206) 555-1402', 'arthur.pendelton@demo.example.com', '742 Cedar Crest Rd, Bellevue, WA', 'Evelyn Pendelton (206) 555-9402', 'Hypertension (controlled with Lisinopril)', 'None reported', 'Requires upright chair positioning.', dateOffset(-210), dateOffset(-5), 'Active'],
      ['PAT-1003', 'Chloe Lindqvist', '1995-01-30', 'Female', '(206) 555-1403', 'chloe.lindqvist@demo.example.com', '905 Alki Point Blvd, Seattle, WA', 'Henrik Lindqvist (206) 555-9403', 'No significant medical history', 'Latex', 'Use nitrile gloves exclusively.', dateOffset(-190), dateOffset(-28), 'Active'],
      ['PAT-1004', 'Derrick Thornton', '1979-11-08', 'Male', '(206) 555-1404', 'derrick.thornton@demo.example.com', '334 Rainier Way, Seattle, WA', 'Tasha Thornton (206) 555-9404', 'Type 2 Diabetes (HbA1c 6.6%)', 'Sulfa drugs', 'Schedule post-meal morning visits.', dateOffset(-175), dateOffset(-19), 'Active'],
      ['PAT-1005', 'Priya Nair', '1992-07-17', 'Female', '(206) 555-1405', 'priya.nair@demo.example.com', '519 Queen Anne Dr, Seattle, WA', 'Rohan Nair (206) 555-9405', 'No chronic conditions', 'None reported', 'Interested in clear aligner assessment.', dateOffset(-160), dateOffset(-3), 'Active'],
      ['PAT-1006', 'Samuel Vance', '1983-02-25', 'Male', '(206) 555-1406', 'samuel.vance@demo.example.com', '208 Fremont Pl, Seattle, WA', 'Laura Vance (206) 555-9406', 'Mild asthma (albuterol PRN)', 'Aspirin', 'Bring inhaler to surgical visits.', dateOffset(-145), dateOffset(-40), 'Active'],
      ['PAT-1007', 'Hannah Goldstein', '2001-06-11', 'Female', '(206) 555-1407', 'hannah.goldstein@demo.example.com', '814 Ravenna Blvd, Seattle, WA', 'Miriam Goldstein (206) 555-9407', 'No chronic conditions', 'None reported', 'College student; prefers late afternoon.', dateOffset(-120), dateOffset(-10), 'Active'],
      ['PAT-1008', 'Mateo Silva', '1974-12-03', 'Male', '(206) 555-1408', 'mateo.silva@demo.example.com', '671 Ballard Way, Seattle, WA', 'Lucia Silva (206) 555-9408', 'Bruxism / nocturnal grinding', 'Codeine', 'Nightguard impression completed.', dateOffset(-105), dateOffset(-2), 'Active'],
      ['PAT-1009', 'Grace Holloway', '1958-08-19', 'Female', '(206) 555-1409', 'grace.holloway@demo.example.com', '445 Madison Park Ter, Seattle, WA', 'Thomas Holloway (206) 555-9409', 'Osteopenia, mild GERD', 'Erythromycin', 'Sensitive lower molars.', dateOffset(-90), dateOffset(-14), 'Active'],
      ['PAT-1010', 'Julian Takahashi', '1990-03-27', 'Male', '(206) 555-1410', 'julian.takahashi@demo.example.com', '129 Capitol Hill Ave, Seattle, WA', 'Kenji Takahashi (206) 555-9410', 'No significant medical history', 'None reported', 'Regular 6-month recall patient.', dateOffset(-72), dateOffset(-7), 'Active'],
      ['PAT-1011', 'Nadia Al-Mansoor', '1986-10-15', 'Female', '(206) 555-1411', 'nadia.almansoor@demo.example.com', '990 Bellevue Way, Bellevue, WA', 'Tariq Al-Mansoor (206) 555-9411', 'Iron-deficiency anemia (resolved)', 'Ibuprofen', 'Use acetaminophen for post-op discomfort.', dateOffset(-54), dateOffset(-21), 'Active'],
      ['PAT-1012', 'Owen Gallagher', '1999-05-06', 'Male', '(206) 555-1412', 'owen.gallagher@demo.example.com', '311 Greenwood Ave, Seattle, WA', 'Fiona Gallagher (206) 555-9412', 'No significant medical history', 'None reported', 'Wisdom tooth evaluation scheduled.', dateOffset(-38), dateOffset(-6), 'Active'],
      ['PAT-1013', 'Beatrice Moreau', '1971-01-12', 'Female', '(206) 555-1413', 'beatrice.moreau@demo.example.com', '77 Mercer Island Dr, Mercer Island, WA', 'Henri Moreau (206) 555-9413', 'Hypothyroidism (Levothyroxine)', 'None reported', 'Crown shade A2 recorded.', dateOffset(-22), dateOffset(-4), 'Active'],
      ['PAT-1014', 'Lucas Novak', '2004-09-09', 'Male', '(206) 555-1414', 'lucas.novak@demo.example.com', '612 University Way, Seattle, WA', 'Elena Novak (206) 555-9414', 'No chronic conditions', 'Amoxicillin', 'Orthodontic retainer check.', dateOffset(-11), dateOffset(-1), 'Active'],
      ['PAT-1015', 'Camille Laurent', '1981-07-29', 'Female', '(206) 555-1415', 'camille.laurent@demo.example.com', '253 Kirkland Ave, Kirkland, WA', 'Marc Laurent (206) 555-9415', 'Mild dental anxiety', 'None reported', 'Prefers topical anesthetic before probing.', dateOffset(-4), null, 'Active'],
    ] as const;

    const patIds: number[] = [];
    for (const p of patientsData) {
      patIds.push(Number(insertPatient.run(...p).lastInsertRowid));
    }

    // 7. 20 Appointments (past, today = offset 0, upcoming)
    const insertAppt = db.prepare(`
      INSERT INTO appointments (
        appointment_code, patient_id, dentist_id, treatment_id, appointment_date, appointment_time, duration_minutes, status, notes, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const dentistsList = [den1, den2, den3, den4];
    const apptsData = [
      // Past completed / cancelled / no-show
      ['APT-4001', patIds[0], den1, trtIds[1], dateOffset(-12), '09:30', 45, 'Completed', 'Routine 6-month prophylaxis completed.'],
      ['APT-4002', patIds[1], den2, trtIds[3], dateOffset(-5), '10:00', 75, 'Completed', 'Endodontic access and instrumentation on #19.'],
      ['APT-4003', patIds[2], den1, trtIds[4], dateOffset(-9), '14:00', 45, 'Cancelled', 'Patient rescheduled due to work travel.'],
      ['APT-4004', patIds[3], den1, trtIds[8], dateOffset(-8), '11:00', 60, 'Completed', 'Lower right quadrant scaling and root planing.'],
      ['APT-4005', patIds[5], den4, trtIds[2], dateOffset(-7), '15:00', 45, 'No-show', 'Patient did not arrive; follow-up call placed.'],
      ['APT-4006', patIds[6], den3, trtIds[7], dateOffset(-10), '13:00', 45, 'Completed', 'Initial orthodontic scan completed.'],
      ['APT-4007', patIds[8], den1, trtIds[6], dateOffset(-4), '09:00', 60, 'Completed', 'Crown prep #14 and temporary placement.'],
      ['APT-4008', patIds[9], den1, trtIds[1], dateOffset(-7), '11:30', 45, 'Completed', 'Cleaning and fluoride varnish.'],
      ['APT-4009', patIds[12], den1, trtIds[6], dateOffset(-4), '13:30', 60, 'Completed', 'Final crown shade check and cementation.'],
      // Today's appointments (offset 0)
      ['APT-4010', patIds[4], den3, trtIds[7], dateOffset(0), '09:00', 45, 'Confirmed', 'Clear aligner treatment plan consultation.'],
      ['APT-4011', patIds[7], den1, trtIds[4], dateOffset(0), '10:00', 45, 'Confirmed', 'Occlusal composite restoration tooth #30.'],
      ['APT-4012', patIds[10], den2, trtIds[3], dateOffset(0), '11:00', 75, 'Scheduled', 'Root canal obturation completion #3.'],
      ['APT-4013', patIds[11], den4, trtIds[2], dateOffset(0), '13:30', 45, 'Confirmed', 'Impacted tooth #32 surgical evaluation & extraction.'],
      ['APT-4014', patIds[13], den3, trtIds[0], dateOffset(0), '15:00', 30, 'Scheduled', 'Retainer fit check and hygiene exam.'],
      ['APT-4015', patIds[14], den1, trtIds[0], dateOffset(0), '16:00', 30, 'Scheduled', 'New patient comprehensive oral examination.'],
      // Upcoming appointments
      ['APT-4016', patIds[0], den1, trtIds[5], dateOffset(1), '10:00', 60, 'Confirmed', 'In-clinic whitening session.'],
      ['APT-4017', patIds[2], den1, trtIds[4], dateOffset(2), '11:00', 45, 'Scheduled', 'Rescheduled composite filling #12.'],
      ['APT-4018', patIds[6], den3, trtIds[7], dateOffset(3), '14:00', 45, 'Confirmed', 'Aligner tray delivery #1-#4.'],
      ['APT-4019', patIds[8], den4, trtIds[9], dateOffset(4), '10:30', 45, 'Scheduled', 'CBCT implant site evaluation #19.'],
      ['APT-4020', patIds[3], den1, trtIds[1], dateOffset(6), '09:30', 45, 'Scheduled', 'Periodontal maintenance recall.'],
    ] as const;

    for (const a of apptsData) {
      insertAppt.run(...a);
    }

    // 8. Treatment Plans
    const insertPlan = db.prepare(`
      INSERT INTO treatment_plans (
        plan_code, patient_id, dentist_id, treatment_id, diagnosis, treatment_notes, estimated_cost, start_date, status, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertPlan.run('PLN-5001', patIds[1], den2, trtIds[3], 'Irreversible pulpitis, tooth #19', 'Two-visit endodontic therapy followed by full-coverage crown.', 890, dateOffset(-5), 'In Progress');
    insertPlan.run('PLN-5002', patIds[4], den3, trtIds[7], 'Mild anterior crowding (Class I)', '16-week clear aligner protocol with bi-monthly tracking.', 120, dateOffset(0), 'Planned');
    insertPlan.run('PLN-5003', patIds[8], den1, trtIds[6], 'Fractured mesiolingual cusp, tooth #14', 'Lithium disilicate crown restoration.', 1150, dateOffset(-14), 'Completed');
    insertPlan.run('PLN-5004', patIds[3], den1, trtIds[8], 'Localized Stage II periodontitis, LRQ', 'Scaling and root planing with 6-week pocket re-evaluation.', 310, dateOffset(-19), 'In Progress');
    insertPlan.run('PLN-5005', patIds[11], den4, trtIds[2], 'Partially impacted mandibular third molar #32', 'Surgical extraction under local anesthesia.', 240, dateOffset(0), 'Planned');

    // 9. Dental History & Examination Records
    const insertRecord = db.prepare(`
      INSERT INTO dental_records (
        record_code, patient_id, dentist_id, visit_date, chief_complaint, examination_notes, diagnosis, tooth_area, treatment_recommendation, follow_up_date, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertRecord.run(
      'REC-6001', patIds[0], den1, dateOffset(-12),
      'Routine 6-month checkup and mild cold sensitivity',
      'Gingiva pink and firm, probing depths 2–3mm. Mild cervical abrasion noted on buccal #11.',
      'Cervical abrasion without caries',
      'Tooth #11 (Maxillary Left Canine)',
      'Desensitizing fluoride varnish; soft-bristle brushing technique advised.',
      dateOffset(168)
    );
    insertRecord.run(
      'REC-6002', patIds[1], den2, dateOffset(-5),
      'Throbbing pain to thermal stimuli on lower left',
      'Deep distal restoration with positive percussion and lingering cold response >20s. Periapical radiolucency minimal.',
      'Symptomatic irreversible pulpitis',
      'Tooth #19 (Mandibular Left First Molar)',
      'Complete root canal therapy and refer back for permanent crown coverage.',
      dateOffset(9)
    );
    insertRecord.run(
      'REC-6003', patIds[3], den1, dateOffset(-19),
      'Bleeding during flossing in lower right quadrant',
      '4–5mm probing pockets on #29–#31 with localized bleeding on probing and subgingival calculus.',
      'Localized moderate periodontitis',
      'Lower Right Quadrant (#28–#32)',
      'Quadrant scaling and root planing followed by 6-week periodontal maintenance.',
      dateOffset(6)
    );
    insertRecord.run(
      'REC-6004', patIds[7], den1, dateOffset(-2),
      'Chipped occlusal edge on lower right molar',
      'Small enamel-dentin fracture on mesio-occlusal margin; pulp vitality normal to cold test.',
      'Localized occlusal caries / marginal fracture',
      'Tooth #30 (Mandibular Right First Molar)',
      'Direct composite resin restoration and nightguard review.',
      dateOffset(30)
    );
    insertRecord.run(
      'REC-6005', patIds[12], den1, dateOffset(-4),
      'Final seating for ceramic crown',
      'Marginal fit verified via bitewing radiograph; occlusal contacts balanced in centric and lateral excursions.',
      'Post-endodontic structural restoration',
      'Tooth #14 (Maxillary Left First Molar)',
      'Routine 6-month recall; avoid chewing hard ice.',
      dateOffset(176)
    );

    // 10. Prescriptions & Items
    const insertRx = db.prepare(`
      INSERT INTO prescriptions (prescription_code, patient_id, dentist_id, prescription_date, additional_instructions, is_demo)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const insertRxItem = db.prepare(`
      INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration)
      VALUES (?, ?, ?, ?, ?)
    `);

    const rx1 = Number(insertRx.run('RX-7001', patIds[1], den2, dateOffset(-5), 'Take with food. Contact clinic immediately if facial swelling increases.').lastInsertRowid);
    insertRxItem.run(rx1, 'Amoxicillin', '500 mg capsule', 'Every 8 hours (3 times daily)', '7 days');
    insertRxItem.run(rx1, 'Ibuprofen', '400 mg tablet', 'Every 6 hours as needed for pain', '5 days');

    const rx2 = Number(insertRx.run('RX-7002', patIds[3], den1, dateOffset(-19), 'Swish for 30 seconds after brushing; do not rinse with water for 30 minutes.').lastInsertRowid);
    insertRxItem.run(rx2, 'Chlorhexidine Gluconate 0.12%', '15 mL oral rinse', 'Twice daily', '14 days');

    const rx3 = Number(insertRx.run('RX-7003', patIds[11], den4, dateOffset(0), 'Begin analgesic 1 hour after procedure before numbness wears off.').lastInsertRowid);
    insertRxItem.run(rx3, 'Acetaminophen', '500 mg tablet', 'Every 6 hours as needed', '4 days');
    insertRxItem.run(rx3, 'Clindamycin', '300 mg capsule', 'Every 8 hours', '5 days');

    // 11. 10 Invoices + Items + Payments
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        invoice_number, patient_id, invoice_date, subtotal, discount, tax_amount, total, amount_paid, payment_status, notes, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertInvItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, treatment_id, description, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (invoice_id, payment_date, amount, payment_method, reference_number, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const invoicesSeed = [
      { num: 'INV-8001', pat: patIds[0], date: dateOffset(-12), trt: trtIds[1], desc: 'Teeth Cleaning', qty: 1, price: 140, disc: 0, taxRate: 0.05, paidRatio: 1, method: 'Card', ref: 'TXN-99101' },
      { num: 'INV-8002', pat: patIds[1], date: dateOffset(-5), trt: trtIds[3], desc: 'Root Canal Treatment', qty: 1, price: 890, disc: 40, taxRate: 0.05, paidRatio: 0.5, method: 'Card', ref: 'TXN-99102' },
      { num: 'INV-8003', pat: patIds[3], date: dateOffset(-19), trt: trtIds[8], desc: 'Periodontal Scaling', qty: 1, price: 310, disc: 0, taxRate: 0.05, paidRatio: 1, method: 'Insurance', ref: 'INS-44210' },
      { num: 'INV-8004', pat: patIds[6], date: dateOffset(-10), trt: trtIds[7], desc: 'Braces Consultation', qty: 1, price: 120, disc: 0, taxRate: 0.05, paidRatio: 1, method: 'Cash', ref: 'CSH-102' },
      { num: 'INV-8005', pat: patIds[8], date: dateOffset(-14), trt: trtIds[6], desc: 'Dental Crown', qty: 1, price: 1150, disc: 50, taxRate: 0.05, paidRatio: 1, method: 'Bank Transfer', ref: 'ACH-7712' },
      { num: 'INV-8006', pat: patIds[9], date: dateOffset(-7), trt: trtIds[1], desc: 'Teeth Cleaning', qty: 1, price: 140, disc: 0, taxRate: 0.05, paidRatio: 1, method: 'Card', ref: 'TXN-99145' },
      { num: 'INV-8007', pat: patIds[12], date: dateOffset(-4), trt: trtIds[6], desc: 'Dental Crown', qty: 1, price: 1150, disc: 0, taxRate: 0.05, paidRatio: 0.6, method: 'Card', ref: 'TXN-99188' },
      { num: 'INV-8008', pat: patIds[7], date: dateOffset(0), trt: trtIds[4], desc: 'Dental Filling', qty: 1, price: 210, disc: 0, taxRate: 0.05, paidRatio: 0, method: 'Card', ref: '' },
      { num: 'INV-8009', pat: patIds[4], date: dateOffset(0), trt: trtIds[7], desc: 'Braces Consultation', qty: 1, price: 120, disc: 0, taxRate: 0.05, paidRatio: 1, method: 'Card', ref: 'TXN-99201' },
      { num: 'INV-8010', pat: patIds[11], date: dateOffset(0), trt: trtIds[2], desc: 'Tooth Extraction', qty: 1, price: 240, disc: 20, taxRate: 0.05, paidRatio: 0, method: 'Cash', ref: '' },
    ];

    for (const inv of invoicesSeed) {
      const subtotal = inv.qty * inv.price;
      const tax = Number(((subtotal - inv.disc) * inv.taxRate).toFixed(2));
      const total = Number((subtotal - inv.disc + tax).toFixed(2));
      const paid = Number((total * inv.paidRatio).toFixed(2));
      const status = paid >= total ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending';

      const invRes = insertInvoice.run(inv.num, inv.pat, inv.date, subtotal, inv.disc, tax, total, paid, status, 'Standard clinical billing statement.');
      const invId = Number(invRes.lastInsertRowid);
      insertInvItem.run(invId, inv.trt, inv.desc, inv.qty, inv.price, subtotal);
      if (paid > 0) {
        insertPayment.run(invId, inv.date, paid, inv.method, inv.ref, 'Recorded at clinic front desk');
      }
    }

    // 12. Follow-Ups
    const insertFollowUp = db.prepare(`
      INSERT INTO follow_ups (followup_code, patient_id, dentist_id, follow_up_date, reason, notes, status, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertFollowUp.run('FUP-9001', patIds[1], den2, dateOffset(2), 'Post-RCT symptom check & permanent crown referral', 'Confirm absence of percussion pain on #19.', 'Pending');
    insertFollowUp.run('FUP-9002', patIds[3], den1, dateOffset(6), 'Periodontal pocket depth re-evaluation', 'Measure LRQ #28-#32 attachment levels.', 'Pending');
    insertFollowUp.run('FUP-9003', patIds[12], den1, dateOffset(10), 'Post-crown occlusal comfort check', 'Check bite comfort and gingival margin.', 'Pending');
    insertFollowUp.run('FUP-9004', patIds[0], den1, dateOffset(-5), 'Desensitizing varnish check', 'Patient reported full relief from cold sensitivity.', 'Completed');
    insertFollowUp.run('FUP-9005', patIds[5], den4, dateOffset(1), 'Missed surgical consultation outreach', 'Re-confirm surgical availability.', 'Pending');

    // 13. Notifications
    const insertNotif = db.prepare(`
      INSERT INTO notifications (target_role, title, message, category, is_read, related_link)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertNotif.run(null, 'Today’s Schedule Ready', '6 appointments are scheduled across 4 clinicians today.', 'appointment', 0, 'appointments');
    insertNotif.run(null, 'Upcoming Follow-Up Due', 'Arthur Pendelton post-RCT review is scheduled in 2 days.', 'followup', 0, 'appointments');
    insertNotif.run('Receptionist', 'Pending Invoice Balance', 'Invoice INV-8002 (Arthur Pendelton) has an outstanding balance.', 'payment', 0, 'billing');
    insertNotif.run(null, 'Appointment Cancellation', 'Chloe Lindqvist cancelled her previous filling slot and rebooked.', 'cancellation', 1, 'appointments');

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
