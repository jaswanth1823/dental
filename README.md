# 🦷 ClarityDental — Dental Clinic Management System (DCMS)

A modern, full-stack Dental Clinic Management System built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Express**. ClarityDental delivers role-based access control, conflict-checked scheduling, interactive clinical charting, treatment plans, prescriptions, invoicing with partial payments, and analytics.

---

## 🚀 Key Features

- **🔐 Role-Based Access Control (RBAC)**:
  - **Administrator**: Full clinic oversight, user & staff management, audit trail, reports.
  - **Dentist**: Patient charts, dental timelines, treatment plans, multi-medication prescriptions.
  - **Receptionist**: Patient onboarding, calendar bookings, check-in/out, billing & payments.
- **📅 Smart Appointment Scheduling**:
  - Interactive Day, Week, and Month calendar views.
  - Built-in **double-booking prevention** and doctor conflict detection (`409 Conflict`).
- **📋 Patient Profiles & Clinical Records**:
  - Contact information, emergency contacts, medical history, and allergy tracking.
  - Duplicate email/phone prevention.
  - Visual dental timeline and treatment history.
- **💊 Treatment Plans & Prescriptions**:
  - Procedure-level planning with cost estimations.
  - Printable multi-medication prescriptions with dosage instructions.
- **💳 Invoicing & Billing**:
  - Automatic subtotal, discount, tax, and balance calculations.
  - Full support for partial payments and installment tracking.
- **📊 Reports & Data Export**:
  - Revenue, visit volume, and treatment distribution analytics.
  - Date range filtering and one-click **CSV Export**.
- **📦 Zero-Setup Database**:
  - Out-of-the-box relational **SQLite engine** (`node:sqlite`) with foreign keys and transactions.
  - Pre-seeded with realistic clinic demo records.
  - Production-ready schema included for **MySQL 8.0+**.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide React, Chart.js |
| **Backend** | Node.js (v22+), Express, Cookie-Parser, Bcrypt.js |
| **Database** | Built-in `node:sqlite` (SQLite in `data/dcms.db`), optional MySQL 8.0+ |
| **Tooling** | TSX, TypeScript (`tsc --noEmit`), Vite |

---

## ⚡ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) **v22.0.0 or higher** (uses native `node:sqlite`).
- npm or pnpm package manager.

### 1. Clone & Install
```bash
git clone https://github.com/jaswanth1823/dental.git
cd dental
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` if you wish to configure a custom port or API keys:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
The full-stack application will boot at: **`http://localhost:3000`**  
*(The database automatically creates and seeds demo records on first startup).*

### 4. Production Build
```bash
npm run build
npm start
```

---

## 🔑 Demo Login Credentials

All demo accounts use bcrypt-hashed passwords:

| Role | Username | Email | Password |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin@claritydental.example.com` | `Admin@123` |
| **Dentist (Lead)** | `elena.vance` | `elena.vance@claritydental.example.com` | `Dentist@123` |
| **Dentist (Endodontics)** | `marcus.chen` | `marcus.chen@claritydental.example.com` | `Dentist@123` |
| **Receptionist** | `reception` | `reception@claritydental.example.com` | `Reception@123` |

---

## 🗄️ Database Architecture & MySQL Setup

By default, the server runs an embedded relational SQLite database stored at `data/dcms.db`.

To switch to **MySQL 8.0+**:
1. Run the database schema in `database/mysql_schema.sql`:
   ```bash
   mysql -u root -p < database/mysql_schema.sql
   ```
2. Configure your MySQL credentials in `.env`:
   ```env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=your_user
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=dcms_db
   ```

---

## 🧪 Testing & Verification Guide

- **Lint & Type Check**:
  ```bash
  npm run lint
  ```
- **Health Check Endpoint**:
  ```bash
  curl http://localhost:3000/api/health
  # {"status":"ok","service":"clarity-dental-dcms"}
  ```
- **Verification Checklist**:
  1. **Authentication**: Test login with `admin`, `elena.vance`, and `reception` to verify role-based permissions.
  2. **Patient Validation**: Try creating a duplicate patient with the same phone or email to verify `409 Conflict`.
  3. **Conflict Detection**: Book overlapping appointments for the same dentist to test double-booking safeguards.
  4. **Billing**: Generate an invoice, apply a partial payment, and confirm remaining balance calculations.
  5. **Analytics**: Navigate to Reports, adjust date filters, and verify CSV exports.

---

## 📁 Project Structure

```text
claritydental-dcms/
├── database/               # SQL DDL schemas and migration documentation
│   ├── mysql_schema.sql    # Production MySQL 8.0+ relational schema
│   └── README_SETUP.md     # Database setup notes
├── server/                 # Express backend API
│   ├── db/                 # SQLite connection & demo seeding logic
│   ├── middleware/         # Auth & RBAC token validation
│   ├── routes/             # Modular REST API endpoints (auth, patients, clinical, billing)
│   └── utils/              # Helper utilities
├── src/                    # React 19 Frontend
│   ├── api/                # API client with error handling
│   ├── components/         # Reusable UI primitives and layout shell
│   ├── pages/              # Role-specific application views
│   └── types/              # Shared TypeScript definitions
├── server.ts               # Full-stack server entry point (Vite + Express)
├── package.json
└── vite.config.ts
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
