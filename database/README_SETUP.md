# ClarityDental — Dental Clinic Management System (DCMS)

## Overview
ClarityDental is a full-stack Dental Clinic Management System featuring role-based access control (Administrator, Dentist, Receptionist), patient registration and clinical profiles, conflict-checked appointment scheduling with Day/Week/Month calendars, dental examination timelines, treatment plans, printable prescriptions, billing & payments, follow-up tracking, analytics reports with CSV export, and in-app notifications.

## Demo Login Credentials
All demo accounts use bcrypt-hashed passwords:

| Role | Username | Email | Password |
| :--- | :--- | :--- | :--- |
| Administrator | `admin` | `admin@claritydental.example.com` | `Admin@123` |
| Dentist (Lead) | `elena.vance` | `elena.vance@claritydental.example.com` | `Dentist@123` |
| Dentist (Endodontics) | `marcus.chen` | `marcus.chen@claritydental.example.com` | `Dentist@123` |
| Receptionist | `reception` | `reception@claritydental.example.com` | `Reception@123` |

## Running Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the full-stack server (port 3000):
   ```bash
   npm run dev
   ```
3. Build for production & run:
   ```bash
   npm run build
   npm start
   ```

## Database Architecture & MySQL Setup
The runtime includes an automatic relational SQLite engine (`node:sqlite` stored in `data/dcms.db`) with strict foreign keys, unique constraints, and transactions so the application runs immediately out-of-the-box without requiring a separate database daemon.

To deploy against **MySQL 8.0+**:
1. Run the DDL script in `database/mysql_schema.sql`:
   ```bash
   mysql -u root -p < database/mysql_schema.sql
   ```
2. Configure your connection credentials in `.env` (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=dcms_db`).

## Verification & Testing Checklist
- Sign in as `admin`, `elena.vance`, and `reception` to verify role-based UI and backend API enforcement (`403 Forbidden` on unauthorized routes).
- Create a patient and verify duplicate email/phone protection (`409 Conflict`).
- Schedule two overlapping appointments for the same dentist and verify conflict prevention (`409 Conflict`).
- Record a dental examination entry and treatment plan in a patient's profile.
- Create and print a multi-medication prescription.
- Create an invoice, apply a partial payment, verify automatic subtotal/discount/tax/balance calculations, and record a follow-up payment.
- Filter reports by date range and export CSV.
