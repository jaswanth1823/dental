import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  List,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import type {
  Appointment,
  AppointmentStatus,
  AuthUser,
  Dentist,
  FollowUp,
  Patient,
  Treatment,
} from '../types/dcms';
import { ConfirmDialog, EmptyState, Modal, StatusTag } from '../components/ui/Primitives';

interface AvailabilityInfo {
  dentist_name: string;
  works_on_day: boolean;
  available_days: string;
  start_hour: string;
  end_hour: string;
  booked_slots: Array<{ id: number; appointment_code: string; appointment_time: string; duration_minutes: number }>;
}

const STATUS_CAL_COLOR: Record<AppointmentStatus, string> = {
  Scheduled: 'bg-amber-50 border-amber-300 text-amber-900',
  Confirmed: 'bg-teal-50 border-teal-300 text-teal-900',
  Completed: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  Cancelled: 'bg-red-50 border-red-200 text-red-800 line-through',
  'No-show': 'bg-slate-100 border-slate-300 text-slate-600',
};

export function AppointmentsPage({
  user,
  appointments,
  followUps,
  patients,
  dentists,
  treatments,
  prefillPatientId,
  openBookingOnMount,
  onClearPrefill,
  onRefreshData,
  onNotify,
  onOpenPatient,
}: {
  user: AuthUser;
  appointments: Appointment[];
  followUps: FollowUp[];
  patients: Patient[];
  dentists: Dentist[];
  treatments: Treatment[];
  prefillPatientId: number | null;
  openBookingOnMount: boolean;
  onClearPrefill: () => void;
  onRefreshData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onOpenPatient: (id: number) => void;
}) {
  const [sectionTab, setSectionTab] = useState<'list' | 'calendar' | 'followups'>('list');
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month'>('week');
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dentistFilter, setDentistFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Booking / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [availability, setAvailability] = useState<AvailabilityInfo | null>(null);

  const [form, setForm] = useState({
    patient_id: '',
    dentist_id: '',
    treatment_id: '',
    appointment_date: new Date().toISOString().slice(0, 10),
    appointment_time: '09:30',
    duration_minutes: 30,
    status: 'Scheduled' as AppointmentStatus,
    notes: '',
  });

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Follow-up modal
  const [fupModalOpen, setFupModalOpen] = useState(false);
  const [fupSaving, setFupSaving] = useState(false);
  const [fupForm, setFupForm] = useState({
    patient_id: '',
    dentist_id: '',
    follow_up_date: new Date().toISOString().slice(0, 10),
    reason: '',
    notes: '',
    status: 'Pending' as 'Pending' | 'Completed' | 'Cancelled',
  });

  useEffect(() => {
    if (openBookingOnMount || prefillPatientId) {
      openNewBooking(prefillPatientId || undefined);
      onClearPrefill();
    }
  }, [openBookingOnMount, prefillPatientId]);

  useEffect(() => {
    if (!modalOpen || !form.dentist_id || !form.appointment_date) {
      setAvailability(null);
      return;
    }
    apiRequest<AvailabilityInfo>(
      `/api/appointments/availability?dentist_id=${form.dentist_id}&date=${form.appointment_date}`
    )
      .then((res) => setAvailability(res))
      .catch(() => setAvailability(null));
  }, [modalOpen, form.dentist_id, form.appointment_date]);

  const openNewBooking = (patId?: number) => {
    const defaultTrt = treatments.find((t) => t.status === 'Active');
    setEditingAppt(null);
    setFormError('');
    setForm({
      patient_id: String(patId || patients[0]?.id || ''),
      dentist_id: String(dentists[0]?.id || ''),
      treatment_id: String(defaultTrt?.id || ''),
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: '09:30',
      duration_minutes: defaultTrt?.duration_minutes || 30,
      status: 'Scheduled',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditBooking = (a: Appointment) => {
    setEditingAppt(a);
    setFormError('');
    setForm({
      patient_id: String(a.patient_id),
      dentist_id: String(a.dentist_id),
      treatment_id: String(a.treatment_id),
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time,
      duration_minutes: a.duration_minutes,
      status: a.status,
      notes: a.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.patient_id || !form.dentist_id || !form.treatment_id || !form.appointment_date || !form.appointment_time) {
      setFormError('Please select patient, dentist, treatment, date, and time.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patient_id: Number(form.patient_id),
        dentist_id: Number(form.dentist_id),
        treatment_id: Number(form.treatment_id),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        duration_minutes: Number(form.duration_minutes),
        status: form.status,
        notes: form.notes,
      };
      if (editingAppt) {
        await apiRequest(`/api/appointments/${editingAppt.id}`, { method: 'PUT', body: payload });
        onNotify('success', `Appointment ${editingAppt.appointment_code} updated.`);
      } else {
        const res = await apiRequest<{ appointment: Appointment }>('/api/appointments', {
          method: 'POST',
          body: payload,
        });
        onNotify(
          'success',
          `Confirmed booking ${res.appointment.appointment_code} for ${res.appointment.patient_name}.`
        );
      }
      setModalOpen(false);
      await onRefreshData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save appointment.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (a: Appointment, status: AppointmentStatus) => {
    try {
      await apiRequest(`/api/appointments/${a.id}`, {
        method: 'PUT',
        body: { status },
      });
      onNotify('success', `${a.appointment_code} marked as ${status}.`);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update status.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiRequest(`/api/appointments/${cancelTarget.id}`, {
        method: 'PUT',
        body: { status: 'Cancelled' },
      });
      onNotify('info', `Appointment ${cancelTarget.appointment_code} cancelled.`);
      setCancelTarget(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFupSaving(true);
    try {
      await apiRequest('/api/appointments/follow-ups', {
        method: 'POST',
        body: {
          patient_id: Number(fupForm.patient_id),
          dentist_id: Number(fupForm.dentist_id),
          follow_up_date: fupForm.follow_up_date,
          reason: fupForm.reason,
          notes: fupForm.notes,
          status: fupForm.status,
        },
      });
      onNotify('success', 'Follow-up scheduled.');
      setFupModalOpen(false);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to schedule follow-up.');
    } finally {
      setFupSaving(false);
    }
  };

  const handleFollowUpStatus = async (f: FollowUp, status: 'Pending' | 'Completed' | 'Cancelled') => {
    try {
      await apiRequest(`/api/appointments/follow-ups/${f.id}`, {
        method: 'PUT',
        body: { status },
      });
      onNotify('success', `Follow-up ${f.followup_code} updated to ${status}.`);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update follow-up.');
    }
  };

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (dateFilter && a.appointment_date !== dateFilter) return false;
      if (dentistFilter !== 'All' && String(a.dentist_id) !== dentistFilter) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.patient_name.toLowerCase().includes(q) ||
        a.appointment_code.toLowerCase().includes(q) ||
        a.dentist_name.toLowerCase().includes(q) ||
        a.treatment_name.toLowerCase().includes(q)
      );
    });
  }, [appointments, search, dateFilter, dentistFilter, statusFilter]);

  // Calendar helpers
  const shiftCursor = (delta: number) => {
    const d = new Date(cursorDate + 'T00:00:00');
    if (calendarMode === 'day') d.setDate(d.getDate() + delta);
    else if (calendarMode === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setCursorDate(d.toISOString().slice(0, 10));
  };

  const weekDates = useMemo(() => {
    const base = new Date(cursorDate + 'T00:00:00');
    const day = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      return dt.toISOString().slice(0, 10);
    });
  }, [cursorDate]);

  const monthGridDates = useMemo(() => {
    const base = new Date(cursorDate + 'T00:00:00');
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    return Array.from({ length: 35 }, (_, i) => {
      const dt = new Date(gridStart);
      dt.setDate(gridStart.getDate() + i);
      return {
        iso: dt.toISOString().slice(0, 10),
        dayNum: dt.getDate(),
        inMonth: dt.getMonth() === base.getMonth(),
      };
    });
  }, [cursorDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Appointments & Follow-Ups</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Conflict-checked chair scheduling, Day/Week/Month calendar, and post-treatment follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSectionTab('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sectionTab === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setSectionTab('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sectionTab === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setSectionTab('followups')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sectionTab === 'followups' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Follow-Ups ({followUps.filter((f) => f.status === 'Pending').length})</span>
            </button>
          </div>

          {sectionTab === 'followups' ? (
            <button
              type="button"
              onClick={() => {
                setFupForm({
                  patient_id: String(patients[0]?.id || ''),
                  dentist_id: String(dentists[0]?.id || ''),
                  follow_up_date: new Date().toISOString().slice(0, 10),
                  reason: '',
                  notes: '',
                  status: 'Pending',
                });
                setFupModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Follow-Up</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openNewBooking()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Book Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* LIST VIEW */}
      {sectionTab === 'list' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, ID, dentist, or treatment..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="Filter by date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs text-teal-700 hover:underline px-1"
                >
                  Clear date
                </button>
              )}
              <select
                aria-label="Filter by dentist"
                value={dentistFilter}
                onChange={(e) => setDentistFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="All">All Dentists</option>
                {dentists.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.full_name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-show">No-show</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">ID</th>
                    <th className="py-3 px-4 font-medium">Patient</th>
                    <th className="py-3 px-4 font-medium">Dentist</th>
                    <th className="py-3 px-4 font-medium">Date & Time</th>
                    <th className="py-3 px-4 font-medium">Treatment</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 px-4">
                        <EmptyState
                          title="No appointments found"
                          description="No bookings match the current filter criteria."
                          actionLabel="Book Appointment"
                          onAction={() => openNewBooking()}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {a.appointment_code}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onOpenPatient(a.patient_id)}
                            className="font-medium text-slate-900 hover:text-teal-700 text-left"
                          >
                            {a.patient_name}
                          </button>
                          <p className="text-xs text-slate-400 font-mono">{a.patient_code}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">{a.dentist_name}</td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-800 whitespace-nowrap">
                          {a.appointment_date} · {a.appointment_time} ({a.duration_minutes}m)
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">{a.treatment_name}</td>
                        <td className="py-3 px-4">
                          <StatusTag status={a.status} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            {a.status === 'Scheduled' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatus(a, 'Confirmed')}
                                title="Confirm Appointment"
                                className="px-2 py-1 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md whitespace-nowrap"
                              >
                                Confirm
                              </button>
                            )}
                            {['Scheduled', 'Confirmed'].includes(a.status) && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatus(a, 'Completed')}
                                title="Mark Completed"
                                className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditBooking(a)}
                              title="Reschedule / Edit"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {!['Cancelled', 'Completed'].includes(a.status) && (
                              <button
                                type="button"
                                onClick={() => setCancelTarget(a)}
                                title="Cancel Appointment"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CALENDAR VIEW (DAY / WEEK / MONTH) */}
      {sectionTab === 'calendar' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftCursor(-1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                aria-label="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursorDate(new Date().toISOString().slice(0, 10))}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftCursor(1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                aria-label="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="ml-2 text-sm font-semibold text-slate-900 font-mono tabular-nums">
                {calendarMode === 'month' ? cursorDate.slice(0, 7) : cursorDate}
              </span>
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
              {(['day', 'week', 'month'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCalendarMode(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    calendarMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {calendarMode === 'day' && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {appointments.filter((a) => a.appointment_date === cursorDate).length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  No appointments scheduled for {cursorDate}.
                </p>
              ) : (
                appointments
                  .filter((a) => a.appointment_date === cursorDate)
                  .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
                  .map((a) => (
                    <div
                      key={a.id}
                      onClick={() => openEditBooking(a)}
                      className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="font-mono text-sm font-semibold tabular-nums text-slate-800 shrink-0">
                          {a.appointment_time}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {a.patient_name} — {a.treatment_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {a.dentist_name} · {a.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      <StatusTag status={a.status} />
                    </div>
                  ))
              )}
            </div>
          )}

          {calendarMode === 'week' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDates.map((iso) => {
                const dayAppts = appointments
                  .filter((a) => a.appointment_date === iso)
                  .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
                const isToday = iso === new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={iso}
                    className={`border rounded-lg p-2.5 min-h-[200px] flex flex-col ${
                      isToday ? 'border-teal-600 bg-teal-50/20' : 'border-slate-200 bg-slate-50/30'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-700 font-mono tabular-nums pb-2 border-b border-slate-200 mb-2">
                      {new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </p>
                    <div className="space-y-1.5 flex-1">
                      {dayAppts.length === 0 ? (
                        <p className="text-[11px] text-slate-400">Open</p>
                      ) : (
                        dayAppts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => openEditBooking(a)}
                            className={`w-full text-left p-2 rounded-md border text-[11px] transition-opacity hover:opacity-85 ${
                              STATUS_CAL_COLOR[a.status]
                            }`}
                          >
                            <p className="font-mono font-semibold tabular-nums">{a.appointment_time}</p>
                            <p className="font-medium truncate">{a.patient_name}</p>
                            <p className="truncate opacity-80">{a.dentist_name}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calendarMode === 'month' && (
            <div className="grid grid-cols-7 gap-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">
                  {d}
                </div>
              ))}
              {monthGridDates.map((cell) => {
                const dayAppts = appointments.filter((a) => a.appointment_date === cell.iso);
                return (
                  <div
                    key={cell.iso}
                    className={`min-h-[92px] border rounded-lg p-1.5 ${
                      cell.inMonth ? 'bg-white border-slate-200' : 'bg-slate-50/60 border-slate-100 text-slate-400'
                    }`}
                  >
                    <p className="text-[11px] font-mono tabular-nums font-semibold mb-1">{cell.dayNum}</p>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openEditBooking(a)}
                          className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] truncate ${
                            STATUS_CAL_COLOR[a.status]
                          }`}
                        >
                          {a.appointment_time} {a.patient_name}
                        </button>
                      ))}
                      {dayAppts.length > 3 && (
                        <p className="text-[10px] text-slate-500 px-1">+{dayAppts.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FOLLOW-UPS TAB */}
      {sectionTab === 'followups' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Patient</th>
                  <th className="py-3 px-4 font-medium">Dentist</th>
                  <th className="py-3 px-4 font-medium">Follow-Up Date</th>
                  <th className="py-3 px-4 font-medium">Reason</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followUps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      No follow-ups scheduled.
                    </td>
                  </tr>
                ) : (
                  followUps.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{f.followup_code}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{f.patient_name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{f.dentist_name}</td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-800">
                        {f.follow_up_date}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{f.reason}</td>
                      <td className="py-3 px-4">
                        <StatusTag status={f.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1.5">
                          {f.status === 'Pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleFollowUpStatus(f, 'Completed')}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                              >
                                Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFollowUpStatus(f, 'Cancelled')}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Book / Reschedule Appointment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAppt ? `Edit Appointment · ${editingAppt.appointment_code}` : 'Book Appointment'}
        subtitle="System automatically prevents double-booking and verifies dentist working hours."
      >
        <form onSubmit={handleSaveAppointment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={form.patient_id}
                onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.patient_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dentist <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={form.dentist_id}
                onChange={(e) => setForm((f) => ({ ...f, dentist_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} — {d.specialization}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={form.appointment_date}
                onChange={(e) => setForm((f) => ({ ...f, appointment_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Time <span className="text-red-600">*</span>
              </label>
              <input
                type="time"
                required
                value={form.appointment_time}
                onChange={(e) => setForm((f) => ({ ...f, appointment_time: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Duration (min) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={15}
                max={240}
                step={15}
                required
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {availability && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <p className="font-medium">
                {availability.dentist_name} Availability ({availability.start_hour}–{availability.end_hour} ·{' '}
                {availability.available_days})
              </p>
              {!availability.works_on_day ? (
                <p className="text-amber-800">Doctor is not scheduled to work on this weekday.</p>
              ) : availability.booked_slots.length === 0 ? (
                <p className="text-emerald-700">No conflicting bookings on {form.appointment_date}.</p>
              ) : (
                <p className="font-mono text-slate-600">
                  Booked slots:{' '}
                  {availability.booked_slots
                    .map((s) => `${s.appointment_time} (${s.duration_minutes}m)`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Treatment Type <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={form.treatment_id}
                onChange={(e) => {
                  const trt = treatments.find((t) => String(t.id) === e.target.value);
                  setForm((f) => ({
                    ...f,
                    treatment_id: e.target.value,
                    duration_minutes: trt ? trt.duration_minutes : f.duration_minutes,
                  }));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {treatments
                  .filter((t) => t.status === 'Active')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.duration_minutes}m)
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AppointmentStatus }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-show">No-show</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingAppt ? 'Save Changes' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Follow-Up Modal */}
      <Modal
        open={fupModalOpen}
        onClose={() => setFupModalOpen(false)}
        title="Schedule Patient Follow-Up"
      >
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={fupForm.patient_id}
                onChange={(e) => setFupForm((f) => ({ ...f, patient_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dentist <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={fupForm.dentist_id}
                onChange={(e) => setFupForm((f) => ({ ...f, dentist_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Follow-Up Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={fupForm.follow_up_date}
                onChange={(e) => setFupForm((f) => ({ ...f, follow_up_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={fupForm.reason}
                onChange={(e) => setFupForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Post-extraction suture check"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={fupForm.notes}
              onChange={(e) => setFupForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFupModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fupSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {fupSaving ? 'Saving...' : 'Schedule Follow-Up'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Appointment"
        message={`Cancel ${cancelTarget?.appointment_code} for ${cancelTarget?.patient_name} on ${cancelTarget?.appointment_date} at ${cancelTarget?.appointment_time}?`}
        confirmLabel="Cancel Appointment"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
