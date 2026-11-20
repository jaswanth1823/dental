-- =============================================================================
-- Dental Clinic Management System (DCMS) - MySQL 8.0+ Relational Schema
-- Engine: InnoDB | Charset: utf8mb4
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dcms_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dcms_db;

-- 1. Clinic Settings
CREATE TABLE IF NOT EXISTS clinic_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clinic_name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(150) NOT NULL,
  working_hours VARCHAR(150) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  logo_url TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Users (Authentication & Role-Based Access)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('Administrator', 'Dentist', 'Receptionist') NOT NULL,
  avatar_url TEXT NULL,
  notif_appointments TINYINT(1) NOT NULL DEFAULT 1,
  notif_followups TINYINT(1) NOT NULL DEFAULT 1,
  notif_billing TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Staff
CREATE TABLE IF NOT EXISTS staff (
  id INT PRIMARY KEY AUTO_INCREMENT,
  staff_code VARCHAR(30) NOT NULL UNIQUE,
  user_id INT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('Administrator', 'Dentist', 'Receptionist') NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  working_hours VARCHAR(120) NOT NULL,
  avatar_url TEXT NULL,
  status ENUM('Active', 'On Leave', 'Inactive') NOT NULL DEFAULT 'Active',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Dentists (Clinical Profile Extension of Staff)
CREATE TABLE IF NOT EXISTS dentists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  staff_id INT NOT NULL UNIQUE,
  specialization VARCHAR(120) NOT NULL,
  license_number VARCHAR(80) NOT NULL UNIQUE,
  bio TEXT NULL,
  available_days VARCHAR(120) NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  start_hour VARCHAR(10) NOT NULL DEFAULT '09:00',
  end_hour VARCHAR(10) NOT NULL DEFAULT '17:00',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dentist_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Patients
CREATE TABLE IF NOT EXISTS patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('Female', 'Male', 'Other') NOT NULL,
  phone VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  address VARCHAR(255) NOT NULL,
  emergency_contact VARCHAR(150) NOT NULL,
  medical_history TEXT NULL,
  allergies TEXT NULL,
  notes TEXT NULL,
  registration_date DATE NOT NULL,
  last_visit DATE NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. Treatments Catalog
CREATE TABLE IF NOT EXISTS treatments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  treatment_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  cost DECIMAL(10,2) NOT NULL,
  status ENUM('Active', 'Archived') NOT NULL DEFAULT 'Active',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 7. Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  appointment_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  dentist_id INT NOT NULL,
  treatment_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status ENUM('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-show') NOT NULL DEFAULT 'Scheduled',
  notes TEXT NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appt_dentist_date (dentist_id, appointment_date),
  INDEX idx_appt_patient (patient_id),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_treatment FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8. Treatment Plans
CREATE TABLE IF NOT EXISTS treatment_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  dentist_id INT NOT NULL,
  treatment_id INT NOT NULL,
  diagnosis VARCHAR(255) NOT NULL,
  treatment_notes TEXT NULL,
  estimated_cost DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  status ENUM('Planned', 'In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Planned',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_plan_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_treatment FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 9. Dental Examination & History Records
CREATE TABLE IF NOT EXISTS dental_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  record_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  dentist_id INT NOT NULL,
  visit_date DATE NOT NULL,
  chief_complaint VARCHAR(255) NOT NULL,
  examination_notes TEXT NOT NULL,
  diagnosis VARCHAR(255) NOT NULL,
  tooth_area VARCHAR(120) NOT NULL,
  treatment_recommendation TEXT NOT NULL,
  follow_up_date DATE NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_record_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_record_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prescription_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  dentist_id INT NOT NULL,
  prescription_date DATE NOT NULL,
  additional_instructions TEXT NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_rx_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Prescription Items
CREATE TABLE IF NOT EXISTS prescription_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prescription_id INT NOT NULL,
  medication_name VARCHAR(150) NOT NULL,
  dosage VARCHAR(120) NOT NULL,
  frequency VARCHAR(120) NOT NULL,
  duration VARCHAR(120) NOT NULL,
  CONSTRAINT fk_rx_item_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('Paid', 'Pending', 'Partially Paid') NOT NULL DEFAULT 'Pending',
  notes TEXT NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  treatment_id INT NULL,
  description VARCHAR(200) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_inv_item_inv FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_item_trt FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 14. Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('Card', 'Cash', 'Bank Transfer', 'Insurance') NOT NULL,
  reference_number VARCHAR(80) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Follow-Ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  followup_code VARCHAR(30) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  dentist_id INT NOT NULL,
  follow_up_date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  status ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_followup_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_followup_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 16. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  target_role VARCHAR(40) NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  category ENUM('appointment', 'cancellation', 'followup', 'payment', 'system') NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  related_link VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
