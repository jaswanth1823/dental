import React, { useMemo } from 'react';
import {
  CalendarCheck,
  CalendarPlus,
  DollarSign,
  FilePlus2,
  Stethoscope,
  UserPlus,
  Users,
  ClipboardPlus,
} from 'lucide-react';
import type { ChartConfiguration } from 'chart.js';
import type { AuthUser, DashboardResponse } from '../types/dcms';
import { ChartCanvas, StatusTag, formatCurrency } from '../components/ui/Primitives';
import type { NavSection } from '../components/layout/AppShell';

export function DashboardPage({
  user,
  data,
  loading,
  onNavigate,
  onOpenPatient,
  onQuickAction,
}: {
  user: AuthUser;
  data: DashboardResponse | null;
  loading: boolean;
  onNavigate: (section: NavSection) => void;
  onOpenPatient: (patientId: number) => void;
  onQuickAction: (action: 'add-patient' | 'book-appointment' | 'add-treatment' | 'create-invoice') => void;
}) {
  const revenueChartConfig = useMemo<ChartConfiguration>(() => {
    const months = data?.charts.months || [];
    const values = data?.charts.revenueSeries || [];
    return {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Collected Revenue ($)',
            data: values,
            backgroundColor: '#0F766E',
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { color: '#64748B' } },
          x: { grid: { display: false }, ticks: { color: '#64748B' } },
        },
      },
    };
  }, [data]);

  const patientGrowthConfig = useMemo<ChartConfiguration>(() => {
    const months = data?.charts.months || [];
    const values = data?.charts.patientGrowthSeries || [];
    return {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Cumulative Patients',
            data: values,
            borderColor: '#0D9488',
            backgroundColor: 'rgba(13, 148, 136, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#0F766E',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#64748B' } },
          x: { grid: { display: false }, ticks: { color: '#64748B' } },
        },
      },
    };
  }, [data]);

  const dentistApptConfig = useMemo<ChartConfiguration>(() => {
    const rows = data?.charts.apptByDentist || [];
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.dentist_name.replace(/^Dr\.\s+/, 'Dr. ')),
        datasets: [
          {
            label: 'Appointments',
            data: rows.map((r) => r.count),
            backgroundColor: '#1E293B',
            borderRadius: 6,
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#64748B' } },
          y: { grid: { display: false }, ticks: { color: '#475569' } },
        },
      },
    };
  }, [data]);

  const statusDistConfig = useMemo<ChartConfiguration>(() => {
    const rows = data?.charts.statusDistribution || [];
    const colorMap: Record<string, string> = {
      Completed: '#15803D',
      Confirmed: '#0F766E',
      Scheduled: '#D97706',
      Cancelled: '#DC2626',
      'No-show': '#64748B',
    };
    return {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => r.status),
        datasets: [
          {
            data: rows.map((r) => r.count),
            backgroundColor: rows.map((r) => colorMap[r.status] || '#94A3B8'),
            borderWidth: 2,
            borderColor: '#FFFFFF',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, padding: 14, color: '#475569', font: { size: 12 } },
          },
        },
      },
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-slate-200 rounded-xl" />
          <div className="h-72 bg-white border border-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalPatients: 0,
    todaysAppointmentsCount: 0,
    totalDentists: 0,
    monthlyRevenue: 0,
    totalCollectedRevenue: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Clinic Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live clinical schedule, patient census, and billing operations for {user.full_name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onQuickAction('add-patient')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Patient</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('book-appointment')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-teal-700" />
            <span>Book Appointment</span>
          </button>
          {['Administrator', 'Dentist'].includes(user.role) && (
            <button
              type="button"
              onClick={() => onQuickAction('add-treatment')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ClipboardPlus className="w-3.5 h-3.5 text-teal-700" />
              <span>Add Treatment</span>
            </button>
          )}
          {['Administrator', 'Receptionist'].includes(user.role) && (
            <button
              type="button"
              onClick={() => onQuickAction('create-invoice')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-teal-700" />
              <span>Create Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Clinic Statistics">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Patients</p>
            <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
              {stats.totalPatients}
            </p>
            <p className="text-xs text-slate-500 mt-2">Active registered records</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Today&apos;s Appointments</p>
            <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
              {stats.todaysAppointmentsCount}
            </p>
            <p className="text-xs text-slate-500 mt-2">Scheduled across chairs</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Active Dentists</p>
            <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
              {stats.totalDentists}
            </p>
            <p className="text-xs text-slate-500 mt-2">Specialists on roster</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Monthly Collected Revenue</p>
            <p className="text-2xl font-display font-semibold text-slate-900 mt-1 font-mono tabular-nums">
              {formatCurrency(stats.monthlyRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
              Total collected: {formatCurrency(stats.totalCollectedRevenue)}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* 4 Chart.js Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Monthly Revenue</h2>
              <p className="text-xs text-slate-500">Collected payments over the last 6 months</p>
            </div>
          </div>
          <ChartCanvas config={revenueChartConfig} height={220} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Patient Growth</h2>
              <p className="text-xs text-slate-500">Cumulative registered patient count</p>
            </div>
          </div>
          <ChartCanvas config={patientGrowthConfig} height={220} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Appointments by Dentist</h2>
              <p className="text-xs text-slate-500">Total bookings assigned per practitioner</p>
            </div>
          </div>
          <ChartCanvas config={dentistApptConfig} height={220} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Appointment Status Distribution</h2>
              <p className="text-xs text-slate-500">Current breakdown across all bookings</p>
            </div>
          </div>
          <ChartCanvas config={statusDistConfig} height={220} />
        </div>
      </section>

      {/* Today's Appointments & Upcoming Follow-ups */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Appointments</h2>
              <p className="text-xs text-slate-500">Active patient chair schedule for today</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              View full schedule
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Time</th>
                  <th className="py-2.5 px-4 font-medium">Patient</th>
                  <th className="py-2.5 px-4 font-medium">Dentist</th>
                  <th className="py-2.5 px-4 font-medium">Treatment</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!data?.todaysAppointments?.length ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      No appointments scheduled for today.
                    </td>
                  </tr>
                ) : (
                  data.todaysAppointments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {a.appointment_time}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => onOpenPatient(a.patient_id)}
                          className="font-medium text-slate-900 hover:text-teal-700 text-left"
                        >
                          {a.patient_name}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">{a.dentist_name}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">{a.treatment_name}</td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={a.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Upcoming Follow-Ups</h2>
              <p className="text-xs text-slate-500">Pending post-treatment patient checks</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Manage follow-ups
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {!data?.upcomingFollowUps?.length ? (
              <p className="py-8 text-center text-xs text-slate-500">No pending follow-ups.</p>
            ) : (
              data.upcomingFollowUps.map((f) => (
                <div key={f.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenPatient(f.patient_id)}
                      className="text-sm font-medium text-slate-900 hover:text-teal-700 truncate block text-left"
                    >
                      {f.patient_name}
                    </button>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{f.reason}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {f.dentist_name} · <span className="font-mono tabular-nums">{f.follow_up_date}</span>
                    </p>
                  </div>
                  <StatusTag status={f.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Upcoming Appointments, Recent Patients, Recent Transactions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Appointments</h2>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs text-teal-700 hover:text-teal-800 font-medium"
            >
              All
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {!data?.upcomingAppointments?.length ? (
              <p className="p-6 text-xs text-slate-500 text-center">No upcoming appointments.</p>
            ) : (
              data.upcomingAppointments.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.patient_name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {a.treatment_name} · {a.dentist_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono tabular-nums text-slate-800">{a.appointment_date}</p>
                    <p className="text-xs font-mono tabular-nums text-slate-500">{a.appointment_time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Patients</h2>
            <button
              type="button"
              onClick={() => onNavigate('patients')}
              className="text-xs text-teal-700 hover:text-teal-800 font-medium"
            >
              Directory
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {!data?.recentPatients?.length ? (
              <p className="p-6 text-xs text-slate-500 text-center">No patients found.</p>
            ) : (
              data.recentPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenPatient(p.id)}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.full_name}</p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      {p.patient_code} · {p.is_demo ? 'Demo' : 'Clinic Record'}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                    {p.registration_date}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Transactions</h2>
            {['Administrator', 'Receptionist'].includes(user.role) && (
              <button
                type="button"
                onClick={() => onNavigate('billing')}
                className="text-xs text-teal-700 hover:text-teal-800 font-medium"
              >
                Billing
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {!data?.recentTransactions?.length ? (
              <p className="p-6 text-xs text-slate-500 text-center">No recent payments.</p>
            ) : (
              data.recentTransactions.map((tx) => (
                <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{tx.patient_name}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {tx.invoice_number} · {tx.payment_method}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold tabular-nums text-emerald-700">
                      +{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400">{tx.payment_date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
