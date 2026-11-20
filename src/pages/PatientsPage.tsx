import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import type {
  Appointment,
  AuthUser,
  DentalRecord,
  Dentist,
  FollowUp,
  Invoice,
  Patient,
  Prescription,
  TreatmentPlan,
} from '../types/dcms';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  StatusTag,
  formatCurrency,
} from '../components/ui/Primitives';

type SortKey = 'full_name' | 'age' | 'registration_date' | 'last_visit';
type ProfileTab = 'overview' | 'appointments' | 'dental_history' | 'treatments' | 'prescriptions' | 'billing' | 'notes';

interface PatientProfilePayload {
  patient: Patient;
  appointments: Appointment[];
  dental_records: DentalRecord[];
  treatment_plans: TreatmentPlan[];
  prescriptions: Prescription[];
  invoices: Invoice[];
  follow_ups: FollowUp[];
}

export function PatientsPage({
  user,
  patients,
  dentists,
  selectedPatientId,
  openAddOnMount,
  onClearOpenAdd,
  onSelectPatient,
  onRefreshData,
  onNotify,
  onBookForPatient,
}: {
  user: AuthUser;
  patients: Patient[];
  dentists: Dentist[];
  selectedPatientId: number | null;
  openAddOnMount: boolean;
  onClearOpenAdd: () => void;
  onSelectPatient: (id: number | null) => void;
  onRefreshData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onBookForPatient: (patientId: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Female' | 'Male' | 'Other'>('All');
  const [sortKey, setSortKey] = useState<SortKey>('registration_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Add/Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: 'Female' as 'Female' | 'Male' | 'Other',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    medical_history: '',
    allergies: '',
    notes: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Patient Profile View
  const [profileData, setProfileData] = useState<PatientProfilePayload | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');

  // Add Dental Examination Modal
  const [examOpen, setExamOpen] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examForm, setExamForm] = useState({
    dentist_id: dentists[0]?.id ? String(dentists[0].id) : '',
    visit_date: new Date().toISOString().slice(0, 10),
    chief_complaint: '',
    tooth_area: '',
    examination_notes: '',
    diagnosis: '',
    treatment_recommendation: '',
    follow_up_date: '',
  });

  useEffect(() => {
    if (openAddOnMount) {
      openNewModal();
      onClearOpenAdd();
    }
  }, [openAddOnMount]);

  useEffect(() => {
    if (!selectedPatientId) {
      setProfileData(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    apiRequest<PatientProfilePayload>(`/api/patients/${selectedPatientId}`)
      .then((res) => {
        if (active) setProfileData(res);
      })
      .catch((err) => {
        if (active) onNotify('error', err instanceof Error ? err.message : 'Unable to load patient profile.');
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedPatientId]);

  const reloadProfile = async (id: number) => {
    const res = await apiRequest<PatientProfilePayload>(`/api/patients/${id}`);
    setProfileData(res);
  };

  const openNewModal = () => {
    setEditingPatient(null);
    setFormError('');
    setForm({
      full_name: '',
      date_of_birth: '',
      gender: 'Female',
      phone: '',
      email: '',
      address: '',
      emergency_contact: '',
      medical_history: '',
      allergies: '',
      notes: '',
      status: 'Active',
    });
    setFormOpen(true);
  };

  const openEditModal = (p: Patient) => {
    setEditingPatient(p);
    setFormError('');
    setForm({
      full_name: p.full_name,
      date_of_birth: p.date_of_birth,
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      address: p.address,
      emergency_contact: p.emergency_contact,
      medical_history: p.medical_history || '',
      allergies: p.allergies || '',
      notes: p.notes || '',
      status: p.status,
    });
    setFormOpen(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.full_name.trim() || !form.date_of_birth || !form.phone.trim() || !form.email.trim() || !form.address.trim() || !form.emergency_contact.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    try {
      if (editingPatient) {
        await apiRequest(`/api/patients/${editingPatient.id}`, { method: 'PUT', body: form });
        onNotify('success', `Updated patient record for ${form.full_name}.`);
        if (selectedPatientId === editingPatient.id) {
          await reloadProfile(editingPatient.id);
        }
      } else {
        await apiRequest('/api/patients', { method: 'POST', body: form });
        onNotify('success', `Registered new patient ${form.full_name}.`);
      }
      setFormOpen(false);
      await onRefreshData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save patient.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/patients/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify('success', `Removed patient ${deleteTarget.full_name}.`);
      if (selectedPatientId === deleteTarget.id) {
        onSelectPatient(null);
      }
      setDeleteTarget(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete patient.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData) return;
    setExamSaving(true);
    try {
      await apiRequest('/api/dental-records', {
        method: 'POST',
        body: {
          patient_id: profileData.patient.id,
          dentist_id: Number(examForm.dentist_id || user.dentist_id || dentists[0]?.id),
          visit_date: examForm.visit_date,
          chief_complaint: examForm.chief_complaint,
          tooth_area: examForm.tooth_area,
          examination_notes: examForm.examination_notes,
          diagnosis: examForm.diagnosis,
          treatment_recommendation: examForm.treatment_recommendation,
          follow_up_date: examForm.follow_up_date || null,
        },
      });
      onNotify('success', 'Clinical examination record saved.');
      setExamOpen(false);
      await reloadProfile(profileData.patient.id);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save examination record.');
    } finally {
      setExamSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients
      .filter((p) => {
        if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        if (genderFilter !== 'All' && p.gender !== genderFilter) return false;
        if (!q) return true;
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.patient_code.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'age') {
          cmp = a.age - b.age;
        } else {
          const va = String(a[sortKey] || '');
          const vb = String(b[sortKey] || '');
          cmp = va.localeCompare(vb);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [patients, search, statusFilter, genderFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const canDelete = ['Administrator', 'Receptionist'].includes(user.role);
  const canRecordExam = ['Administrator', 'Dentist'].includes(user.role);

  // ============================================================================
  // PATIENT PROFILE VIEW (7 TABS)
  // ============================================================================
  if (selectedPatientId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onSelectPatient(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Patient Directory</span>
          </button>

          {profileData && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onBookForPatient(profileData.patient.id)}
                className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Book Appointment
              </button>
              {canRecordExam && (
                <button
                  type="button"
                  onClick={() => {
                    setExamForm({
                      dentist_id: String(user.dentist_id || dentists[0]?.id || ''),
                      visit_date: new Date().toISOString().slice(0, 10),
                      chief_complaint: '',
                      tooth_area: '',
                      examination_notes: '',
                      diagnosis: '',
                      treatment_recommendation: '',
                      follow_up_date: '',
                    });
                    setExamOpen(true);
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Record Dental Exam
                </button>
              )}
              <button
                type="button"
                onClick={() => openEditModal(profileData.patient)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {profileLoading || !profileData ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Loading patient chart...
          </div>
        ) : (
          <>
            {/* Patient Header Summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-display font-semibold text-slate-900">
                      {profileData.patient.full_name}
                    </h1>
                    <StatusTag status={profileData.patient.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                    {profileData.patient.patient_code} · {profileData.patient.age} yrs ({profileData.patient.gender}) · DOB{' '}
                    {profileData.patient.date_of_birth} · {profileData.patient.is_demo ? 'Demo Record' : 'Clinic Record'}
                  </p>
                </div>

                <div className="text-xs text-slate-600 space-y-1 md:text-right">
                  <p className="font-mono tabular-nums">{profileData.patient.phone}</p>
                  <p>{profileData.patient.email}</p>
                </div>
              </div>

              {/* 7 Profile Tabs */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    ['overview', 'Overview'],
                    ['appointments', `Appointments (${profileData.appointments.length})`],
                    ['dental_history', `Dental History (${profileData.dental_records.length})`],
                    ['treatments', `Treatments (${profileData.treatment_plans.length})`],
                    ['prescriptions', `Prescriptions (${profileData.prescriptions.length})`],
                    ['billing', `Billing (${profileData.invoices.length})`],
                    ['notes', 'Notes'],
                  ] as Array<[ProfileTab, string]>
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setProfileTab(tabKey)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      profileTab === tabKey
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Panels */}
            {profileTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-slate-900">Contact & Demographics</h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Address</dt>
                      <dd className="text-slate-900 mt-0.5">{profileData.patient.address}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Emergency Contact</dt>
                      <dd className="text-slate-900 mt-0.5">{profileData.patient.emergency_contact}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Registration Date</dt>
                      <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">
                        {profileData.patient.registration_date}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Last Visit</dt>
                      <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">
                        {profileData.patient.last_visit || 'No visits yet'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-slate-900">Medical Alerts & History</h2>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Known Allergies</p>
                      <p className="text-slate-900 mt-0.5 font-medium">
                        {profileData.patient.allergies || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Medical History</p>
                      <p className="text-slate-700 mt-0.5 leading-relaxed">
                        {profileData.patient.medical_history || 'No chronic conditions documented.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'appointments' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-3 px-4 font-medium">ID</th>
                        <th className="py-3 px-4 font-medium">Date & Time</th>
                        <th className="py-3 px-4 font-medium">Dentist</th>
                        <th className="py-3 px-4 font-medium">Treatment</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profileData.appointments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                            No appointments recorded for this patient.
                          </td>
                        </tr>
                      ) : (
                        profileData.appointments.map((a) => (
                          <tr key={a.id}>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">{a.appointment_code}</td>
                            <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-800">
                              {a.appointment_date} · {a.appointment_time}
                            </td>
                            <td className="py-3 px-4 text-slate-800">{a.dentist_name}</td>
                            <td className="py-3 px-4 text-slate-600">{a.treatment_name}</td>
                            <td className="py-3 px-4">
                              <StatusTag status={a.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'dental_history' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Clinical Dental Examination Timeline</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clinician-entered examination findings and diagnostic notes recorded by licensed practitioners.
                    </p>
                  </div>
                  {canRecordExam && (
                    <button
                      type="button"
                      onClick={() => setExamOpen(true)}
                      className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
                    >
                      + Add Examination Record
                    </button>
                  )}
                </div>

                {profileData.dental_records.length === 0 ? (
                  <EmptyState
                    title="No dental examination records"
                    description="Examination notes, tooth findings, and clinician diagnoses will appear here chronologically."
                  />
                ) : (
                  <div className="divide-y divide-slate-200">
                    {profileData.dental_records.map((rec) => (
                      <div key={rec.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-mono tabular-nums text-slate-500">
                            {rec.record_code} · Visit {rec.visit_date} · {rec.dentist_name}
                          </div>
                          <span className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                            {rec.tooth_area}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{rec.diagnosis}</p>
                        <p className="text-xs text-slate-600">
                          <span className="font-medium text-slate-800">Chief Complaint:</span> {rec.chief_complaint}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-medium text-slate-800">Examination Notes:</span> {rec.examination_notes}
                        </p>
                        <p className="text-xs text-slate-600">
                          <span className="font-medium text-slate-800">Recommendation:</span>{' '}
                          {rec.treatment_recommendation}
                          {rec.follow_up_date && (
                            <span className="ml-2 font-mono text-slate-500">
                              (Follow-up: {rec.follow_up_date})
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {profileTab === 'treatments' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-3 px-4 font-medium">Plan ID</th>
                        <th className="py-3 px-4 font-medium">Treatment</th>
                        <th className="py-3 px-4 font-medium">Diagnosis</th>
                        <th className="py-3 px-4 font-medium">Dentist</th>
                        <th className="py-3 px-4 font-medium text-right">Est. Cost</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profileData.treatment_plans.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                            No treatment plans assigned yet.
                          </td>
                        </tr>
                      ) : (
                        profileData.treatment_plans.map((tp) => (
                          <tr key={tp.id}>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">{tp.plan_code}</td>
                            <td className="py-3 px-4 font-medium text-slate-900">{tp.treatment_name}</td>
                            <td className="py-3 px-4 text-xs text-slate-600">{tp.diagnosis}</td>
                            <td className="py-3 px-4 text-xs text-slate-600">{tp.dentist_name}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                              {formatCurrency(tp.estimated_cost)}
                            </td>
                            <td className="py-3 px-4">
                              <StatusTag status={tp.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'prescriptions' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                {profileData.prescriptions.length === 0 ? (
                  <EmptyState
                    title="No prescriptions issued"
                    description="Prescriptions created for this patient will be listed here."
                  />
                ) : (
                  profileData.prescriptions.map((rx) => (
                    <div key={rx.id} className="pb-4 border-b border-slate-200 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span>
                          {rx.prescription_code} · {rx.prescription_date}
                        </span>
                        <span>{rx.dentist_name}</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {rx.items.map((item, idx) => (
                          <li key={idx} className="text-slate-800">
                            <span className="font-medium">{item.medication_name}</span> — {item.dosage} ·{' '}
                            {item.frequency} ({item.duration})
                          </li>
                        ))}
                      </ul>
                      {rx.additional_instructions && (
                        <p className="text-xs text-slate-500 mt-1.5">Instructions: {rx.additional_instructions}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {profileTab === 'billing' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                      <tr>
                        <th className="py-3 px-4 font-medium">Invoice #</th>
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium text-right">Total</th>
                        <th className="py-3 px-4 font-medium text-right">Paid</th>
                        <th className="py-3 px-4 font-medium text-right">Balance</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profileData.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                            No billing invoices for this patient.
                          </td>
                        </tr>
                      ) : (
                        profileData.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="py-3 px-4 font-mono text-xs text-slate-700">{inv.invoice_number}</td>
                            <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                              {inv.invoice_date}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                              {formatCurrency(inv.total)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                              {formatCurrency(inv.amount_paid)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                              {formatCurrency(inv.balance)}
                            </td>
                            <td className="py-3 px-4">
                              <StatusTag status={inv.payment_status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'notes' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">General Reception & Clinical Notes</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {profileData.patient.notes || 'No general notes documented for this patient.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Record Dental Examination Modal */}
        <Modal
          open={examOpen}
          onClose={() => setExamOpen(false)}
          title="Record Dental Examination"
          subtitle="Document clinician-observed oral examination findings and diagnosis."
        >
          <form onSubmit={handleSaveExam} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Examining Dentist <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={examForm.dentist_id}
                  onChange={(e) => setExamForm((f) => ({ ...f, dentist_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Visit Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={examForm.visit_date}
                  onChange={(e) => setExamForm((f) => ({ ...f, visit_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Chief Complaint <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={examForm.chief_complaint}
                  onChange={(e) => setExamForm((f) => ({ ...f, chief_complaint: e.target.value }))}
                  placeholder="e.g. Sensitivity to cold on upper left"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tooth / Area Involved <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={examForm.tooth_area}
                  onChange={(e) => setExamForm((f) => ({ ...f, tooth_area: e.target.value }))}
                  placeholder="e.g. Tooth #14 / URQ"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Clinical Examination Notes <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={examForm.examination_notes}
                onChange={(e) => setExamForm((f) => ({ ...f, examination_notes: e.target.value }))}
                placeholder="Probing depths, radiograph observations, percussion response..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Clinician Diagnosis <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={examForm.diagnosis}
                onChange={(e) => setExamForm((f) => ({ ...f, diagnosis: e.target.value }))}
                placeholder="Diagnosis determined by examining dentist"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Treatment Recommendation
                </label>
                <input
                  type="text"
                  value={examForm.treatment_recommendation}
                  onChange={(e) => setExamForm((f) => ({ ...f, treatment_recommendation: e.target.value }))}
                  placeholder="Recommended next procedure"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Follow-Up Date</label>
                <input
                  type="date"
                  value={examForm.follow_up_date}
                  onChange={(e) => setExamForm((f) => ({ ...f, follow_up_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setExamOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={examSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
              >
                {examSaving ? 'Saving...' : 'Save Examination'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Keep Patient Edit Modal available in profile view */}
        {renderPatientModal()}
      </div>
    );
  }

  function renderPatientModal() {
    return (
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPatient ? `Edit Patient · ${editingPatient.patient_code}` : 'Register New Patient'}
        subtitle={editingPatient ? 'Update demographic and medical profile details.' : 'Patient ID is generated automatically upon registration.'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSavePatient} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date of Birth <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={form.date_of_birth}
                onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Gender <span className="text-red-600">*</span>
              </label>
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as 'Female' | 'Male' | 'Other' }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(206) 555-0199"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Home Address <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Emergency Contact <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.emergency_contact}
                onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))}
                placeholder="Name & phone number"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Medical History</label>
              <textarea
                rows={2}
                value={form.medical_history}
                onChange={(e) => setForm((f) => ({ ...f, medical_history: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Allergies</label>
              <textarea
                rows={2}
                value={form.allergies}
                onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Clinical / Reception Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingPatient ? 'Save Changes' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // ============================================================================
  // PATIENT DIRECTORY LIST VIEW
  // ============================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {patients.length} registered patients · Click any row to open full clinical chart.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Patient</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, ID, phone, or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            {(['All', 'Active', 'Inactive'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by gender"
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value as 'All' | 'Female' | 'Male' | 'Other');
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="All">All Genders</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Patients Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-medium">Patient ID</th>
                <th className="py-3 px-4 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('full_name')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Full Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium">Contact</th>
                <th className="py-3 px-4 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('age')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Age / Gender</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('registration_date')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Registered</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('last_visit')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Last Visit</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4">
                    <EmptyState
                      title="No matching patients"
                      description="Adjust your search filter or register a new patient."
                      actionLabel="Register Patient"
                      onAction={openNewModal}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {p.patient_code}
                      {p.is_demo === 1 && <span className="ml-1.5 text-[11px] text-slate-400">· Demo</span>}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectPatient(p.id)}
                        className="font-medium text-slate-900 hover:text-teal-700 text-left"
                      >
                        {p.full_name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-mono tabular-nums text-slate-700">{p.phone}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[190px]">{p.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 font-mono tabular-nums whitespace-nowrap">
                      {p.age} yrs · {p.gender}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {p.registration_date}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {p.last_visit || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusTag status={p.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectPatient(p.id)}
                          aria-label={`View ${p.full_name}`}
                          title="View Profile"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          aria-label={`Edit ${p.full_name}`}
                          title="Edit Patient"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            aria-label={`Delete ${p.full_name}`}
                            title="Delete Patient"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono tabular-nums">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {renderPatientModal()}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Patient Record"
        message={`Are you sure you want to permanently remove ${deleteTarget?.full_name} (${deleteTarget?.patient_code}) and all linked appointments, invoices, and clinical history?`}
        confirmLabel="Delete Patient"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
