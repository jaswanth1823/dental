import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest, setCsrfToken } from './api/client';
import type {
  AppNotification,
  Appointment,
  AuthUser,
  ClinicSettings,
  DashboardResponse,
  Dentist,
  FollowUp,
  Invoice,
  Patient,
  Prescription,
  StaffMember,
  Treatment,
  TreatmentPlan,
} from './types/dcms';
import { AppShell, type NavSection } from './components/layout/AppShell';
import { ToastContainer, type ToastItem } from './components/ui/Primitives';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { DoctorsStaffPage } from './pages/DoctorsStaffPage';
import { TreatmentsPage } from './pages/TreatmentsPage';
import { PrescriptionsPage } from './pages/PrescriptionsPage';
import { BillingPage } from './pages/BillingPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  // Shared domain state
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Cross-page navigation intents
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [openAddPatient, setOpenAddPatient] = useState(false);
  const [openBookAppt, setOpenBookAppt] = useState(false);
  const [prefillPatientForAppt, setPrefillPatientForAppt] = useState<number | null>(null);
  const [openAddTreatment, setOpenAddTreatment] = useState(false);
  const [openCreateInvoice, setOpenCreateInvoice] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const notify = useCallback((type: ToastItem['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const refreshMe = useCallback(async () => {
    const res = await apiRequest<{ user: AuthUser; csrfToken: string }>('/api/auth/me');
    setCsrfToken(res.csrfToken);
    setUser(res.user);
  }, []);

  const loadAllClinicData = useCallback(async (currentUser: AuthUser) => {
    setDataLoading(true);
    try {
      const [
        settingsRes,
        dashRes,
        patientsRes,
        apptsRes,
        fupsRes,
        staffRes,
        dentistsRes,
        treatmentsRes,
        plansRes,
        rxRes,
        invRes,
        notifRes,
      ] = await Promise.all([
        apiRequest<{ settings: ClinicSettings }>('/api/settings'),
        apiRequest<DashboardResponse>('/api/dashboard'),
        apiRequest<{ patients: Patient[] }>('/api/patients'),
        apiRequest<{ appointments: Appointment[] }>('/api/appointments'),
        apiRequest<{ followUps: FollowUp[] }>('/api/appointments/follow-ups/list'),
        apiRequest<{ staff: StaffMember[] }>('/api/staff'),
        apiRequest<{ dentists: Dentist[] }>('/api/dentists'),
        apiRequest<{ treatments: Treatment[] }>('/api/treatments'),
        apiRequest<{ plans: TreatmentPlan[] }>('/api/treatment-plans'),
        apiRequest<{ prescriptions: Prescription[] }>('/api/prescriptions'),
        ['Administrator', 'Receptionist', 'Dentist'].includes(currentUser.role)
          ? apiRequest<{ invoices: Invoice[] }>('/api/invoices')
          : Promise.resolve({ invoices: [] }),
        apiRequest<{ notifications: AppNotification[] }>('/api/notifications'),
      ]);

      setClinicSettings(settingsRes.settings);
      setDashboardData(dashRes);
      setPatients(patientsRes.patients);
      setAppointments(apptsRes.appointments);
      setFollowUps(fupsRes.followUps);
      setStaff(staffRes.staff);
      setDentists(dentistsRes.dentists);
      setTreatments(treatmentsRes.treatments);
      setPlans(plansRes.plans);
      setPrescriptions(rxRes.prescriptions);
      setInvoices(invRes.invoices);
      setNotifications(notifRes.notifications);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to refresh clinic data.');
    } finally {
      setDataLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    refreshMe()
      .catch(() => setUser(null))
      .finally(() => setAuthChecking(false));
  }, [refreshMe]);

  useEffect(() => {
    if (user) {
      loadAllClinicData(user);
    }
  }, [user, loadAllClinicData]);

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setActiveSection('dashboard');
    setSelectedPatientId(null);
  };

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section);
    if (section !== 'patients') {
      setSelectedPatientId(null);
    }
  };

  const handleOpenPatient = (patientId: number) => {
    setSelectedPatientId(patientId);
    setActiveSection('patients');
  };

  const handleQuickAction = (
    action: 'add-patient' | 'book-appointment' | 'add-treatment' | 'create-invoice'
  ) => {
    if (action === 'add-patient') {
      setSelectedPatientId(null);
      setOpenAddPatient(true);
      setActiveSection('patients');
    } else if (action === 'book-appointment') {
      setOpenBookAppt(true);
      setActiveSection('appointments');
    } else if (action === 'add-treatment') {
      setOpenAddTreatment(true);
      setActiveSection('treatments');
    } else if (action === 'create-invoice') {
      setOpenCreateInvoice(true);
      setActiveSection('billing');
    }
  };

  const handleMarkNotificationRead = async (id: number) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' }).catch(() => undefined);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'PUT' }).catch(() => undefined);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center text-sm text-slate-500">
        Loading ClarityDental workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onLoginSuccess={(u) => setUser(u)} />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  const sectionLabels: Record<NavSection, string> = {
    dashboard: 'Dashboard',
    patients: 'Patients',
    appointments: 'Appointments',
    doctors: 'Doctors & Staff',
    treatments: 'Treatments',
    prescriptions: 'Prescriptions',
    billing: 'Billing & Payments',
    reports: 'Reports',
    settings: 'Settings',
  };

  const selectedPatientObj = selectedPatientId
    ? patients.find((p) => p.id === selectedPatientId)
    : null;

  const breadcrumbs = ['ClarityDental', sectionLabels[activeSection]];
  if (activeSection === 'patients' && selectedPatientObj) {
    breadcrumbs.push(selectedPatientObj.full_name);
  }

  return (
    <>
      <AppShell
        user={user}
        clinicSettings={clinicSettings}
        activeSection={activeSection}
        breadcrumbs={breadcrumbs}
        notifications={notifications}
        patientsForSearch={patients}
        onNavigate={handleNavigate}
        onSelectPatientFromSearch={handleOpenPatient}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllRead}
        onLogout={handleLogout}
      >
        {activeSection === 'dashboard' && (
          <DashboardPage
            user={user}
            data={dashboardData}
            loading={dataLoading}
            onNavigate={handleNavigate}
            onOpenPatient={handleOpenPatient}
            onQuickAction={handleQuickAction}
          />
        )}

        {activeSection === 'patients' && (
          <PatientsPage
            user={user}
            patients={patients}
            dentists={dentists}
            selectedPatientId={selectedPatientId}
            openAddOnMount={openAddPatient}
            onClearOpenAdd={() => setOpenAddPatient(false)}
            onSelectPatient={setSelectedPatientId}
            onRefreshData={() => loadAllClinicData(user)}
            onNotify={notify}
            onBookForPatient={(patId) => {
              setPrefillPatientForAppt(patId);
              setOpenBookAppt(true);
              setActiveSection('appointments');
            }}
          />
        )}

        {activeSection === 'appointments' && (
          <AppointmentsPage
            user={user}
            appointments={appointments}
            followUps={followUps}
            patients={patients}
            dentists={dentists}
            treatments={treatments}
            prefillPatientId={prefillPatientForAppt}
            openBookingOnMount={openBookAppt}
            onClearPrefill={() => {
              setPrefillPatientForAppt(null);
              setOpenBookAppt(false);
            }}
            onRefreshData={() => loadAllClinicData(user)}
            onNotify={notify}
            onOpenPatient={handleOpenPatient}
          />
        )}

        {activeSection === 'doctors' && (
          <DoctorsStaffPage
            user={user}
            staff={staff}
            onRefreshData={() => loadAllClinicData(user)}
            onNotify={notify}
            onAssignAppointment={() => {
              setOpenBookAppt(true);
              setActiveSection('appointments');
            }}
          />
        )}

        {activeSection === 'treatments' && (
          <TreatmentsPage
            user={user}
            treatments={treatments}
            plans={plans}
            patients={patients}
            dentists={dentists}
            openAddOnMount={openAddTreatment}
            onClearOpenAdd={() => setOpenAddTreatment(false)}
            onRefreshData={() => loadAllClinicData(user)}
            onNotify={notify}
          />
        )}

        {activeSection === 'prescriptions' && (
          <PrescriptionsPage
            user={user}
            prescriptions={prescriptions}
            patients={patients}
            dentists={dentists}
            clinicSettings={clinicSettings}
            onRefreshData={() => loadAllClinicData(user)}
            onNotify={notify}
          />
        )}

        {activeSection === 'billing' && (
          <BillingPage
            user={user}
            invoices={invoices}
            patients={patients}
            treatments={treatments}
            clinicSettings={clinicSettings}
            openCreateOnMount={openCreateInvoice}
            onClearOpenCreate={() => setOpenCreateInvoice(false)}
            onRefreshData={() => loadAllClinicData(user)}
            onNotify={notify}
          />
        )}

        {activeSection === 'reports' && <ReportsPage onNotify={notify} />}

        {activeSection === 'settings' && (
          <SettingsPage
            user={user}
            clinicSettings={clinicSettings}
            onRefreshSettings={async () => {
              const s = await apiRequest<{ settings: ClinicSettings }>('/api/settings');
              setClinicSettings(s.settings);
            }}
            onRefreshUser={refreshMe}
            onNotify={notify}
          />
        )}
      </AppShell>

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))}
      />
    </>
  );
}
