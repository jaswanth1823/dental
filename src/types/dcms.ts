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

export interface ClinicSettings {
  id: number;
  clinic_name: string;
  address: string;
  phone: string;
  email: string;
  working_hours: string;
  tax_rate: number;
  currency: string;
  logo_url: string | null;
}

export interface Patient {
  id: number;
  patient_code: string;
  full_name: string;
  date_of_birth: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  phone: string;
  email: string;
  address: string;
  emergency_contact: string;
  medical_history: string;
  allergies: string;
  notes: string;
  registration_date: string;
  last_visit: string | null;
  status: 'Active' | 'Inactive';
  is_demo: number;
}

export interface StaffMember {
  id: number;
  staff_code: string;
  user_id: number | null;
  full_name: string;
  role: UserRole;
  phone: string;
  email: string;
  working_hours: string;
  avatar_url: string | null;
  status: 'Active' | 'On Leave' | 'Inactive';
  is_demo: number;
  dentist_id: number | null;
  specialization: string | null;
  license_number: string | null;
  bio: string | null;
  available_days: string | null;
  start_hour: string | null;
  end_hour: string | null;
}

export interface Dentist {
  id: number;
  staff_id: number;
  staff_code: string;
  full_name: string;
  phone: string;
  email: string;
  working_hours: string;
  avatar_url: string | null;
  status: 'Active' | 'On Leave' | 'Inactive';
  specialization: string;
  license_number: string;
  bio: string | null;
  available_days: string;
  start_hour: string;
  end_hour: string;
}

export interface Treatment {
  id: number;
  treatment_code: string;
  name: string;
  description: string;
  duration_minutes: number;
  cost: number;
  status: 'Active' | 'Archived';
  is_demo: number;
}

export type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-show';

export interface Appointment {
  id: number;
  appointment_code: string;
  patient_id: number;
  dentist_id: number;
  treatment_id: number;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string;
  is_demo: number;
  patient_name: string;
  patient_code: string;
  patient_phone?: string;
  dentist_name: string;
  dentist_specialization?: string;
  treatment_name: string;
  treatment_cost?: number;
}

export interface TreatmentPlan {
  id: number;
  plan_code: string;
  patient_id: number;
  dentist_id: number;
  treatment_id: number;
  diagnosis: string;
  treatment_notes: string;
  estimated_cost: number;
  start_date: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
  patient_name: string;
  patient_code: string;
  dentist_name: string;
  treatment_name: string;
}

export interface DentalRecord {
  id: number;
  record_code: string;
  patient_id: number;
  dentist_id: number;
  visit_date: string;
  chief_complaint: string;
  examination_notes: string;
  diagnosis: string;
  tooth_area: string;
  treatment_recommendation: string;
  follow_up_date: string | null;
  patient_name: string;
  patient_code: string;
  dentist_name: string;
}

export interface PrescriptionItem {
  id?: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  id: number;
  prescription_code: string;
  patient_id: number;
  dentist_id: number;
  prescription_date: string;
  additional_instructions: string;
  patient_name: string;
  patient_code: string;
  patient_dob?: string;
  patient_phone?: string;
  patient_allergies?: string;
  dentist_name: string;
  dentist_specialization?: string;
  dentist_license?: string;
  items: PrescriptionItem[];
}

export interface InvoiceItem {
  id?: number;
  treatment_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export interface PaymentRecord {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount: number;
  payment_method: 'Card' | 'Cash' | 'Bank Transfer' | 'Insurance';
  reference_number: string;
  notes: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  patient_id: number;
  invoice_date: string;
  subtotal: number;
  discount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance: number;
  payment_status: 'Paid' | 'Pending' | 'Partially Paid';
  notes: string;
  is_demo: number;
  patient_name: string;
  patient_code: string;
  patient_phone?: string;
  patient_email?: string;
  items: InvoiceItem[];
  payments: PaymentRecord[];
}

export interface FollowUp {
  id: number;
  followup_code: string;
  patient_id: number;
  dentist_id: number;
  follow_up_date: string;
  reason: string;
  notes: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  patient_name: string;
  patient_code: string;
  dentist_name: string;
}

export interface AppNotification {
  id: number;
  target_role: string | null;
  title: string;
  message: string;
  category: 'appointment' | 'cancellation' | 'followup' | 'payment' | 'system';
  is_read: number;
  related_link: string | null;
  created_at: string;
}

export interface DashboardResponse {
  stats: {
    totalPatients: number;
    todaysAppointmentsCount: number;
    totalDentists: number;
    monthlyRevenue: number;
    totalCollectedRevenue: number;
  };
  todaysAppointments: Appointment[];
  upcomingAppointments: Appointment[];
  recentPatients: Patient[];
  recentTransactions: Array<{
    id: number;
    payment_date: string;
    amount: number;
    payment_method: string;
    invoice_number: string;
    patient_name: string;
  }>;
  upcomingFollowUps: FollowUp[];
  charts: {
    months: string[];
    revenueSeries: number[];
    patientGrowthSeries: number[];
    statusDistribution: Array<{ status: string; count: number }>;
    apptByDentist: Array<{ dentist_name: string; count: number }>;
  };
}

export interface ReportsResponse {
  range: { from: string; to: string };
  summary: {
    totalPatients: number;
    newPatientsInRange: number;
    appointments: {
      total: number;
      completed: number;
      cancelled: number;
      no_show: number;
      active: number;
    };
    revenue: {
      billed: number;
      collected: number;
      outstanding: number;
    };
  };
  treatmentRevenue: Array<{ treatment_name: string; total_qty: number; revenue: number }>;
  dentistAppointments: Array<{
    dentist_name: string;
    specialization: string;
    total: number;
    completed: number;
    cancelled: number;
    no_show: number;
  }>;
  monthlyPatients: Array<{ month: string; count: number }>;
  monthlyRevenue: Array<{ month: string; collected: number; billed: number }>;
}
