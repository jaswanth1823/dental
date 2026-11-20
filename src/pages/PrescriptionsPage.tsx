import React, { useMemo, useState } from 'react';
import { Edit3, Eye, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import type {
  AuthUser,
  ClinicSettings,
  Dentist,
  Patient,
  Prescription,
  PrescriptionItem,
} from '../types/dcms';
import { ConfirmDialog, EmptyState, Modal } from '../components/ui/Primitives';

export function PrescriptionsPage({
  user,
  prescriptions,
  patients,
  dentists,
  clinicSettings,
  onRefreshData,
  onNotify,
}: {
  user: AuthUser;
  prescriptions: Prescription[];
  patients: Patient[];
  dentists: Dentist[];
  clinicSettings: ClinicSettings | null;
  onRefreshData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRx, setEditingRx] = useState<Prescription | null>(null);
  const [saving, setSaving] = useState(false);

  const [printRx, setPrintRx] = useState<Prescription | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prescription | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    patient_id: '',
    dentist_id: '',
    prescription_date: new Date().toISOString().slice(0, 10),
    additional_instructions: '',
    items: [{ medication_name: '', dosage: '', frequency: '', duration: '' }] as PrescriptionItem[],
  });

  const openNew = () => {
    setEditingRx(null);
    setForm({
      patient_id: String(patients[0]?.id || ''),
      dentist_id: String(user.dentist_id || dentists[0]?.id || ''),
      prescription_date: new Date().toISOString().slice(0, 10),
      additional_instructions: '',
      items: [{ medication_name: '', dosage: '', frequency: '', duration: '' }],
    });
    setFormOpen(true);
  };

  const openEdit = (rx: Prescription) => {
    setEditingRx(rx);
    setForm({
      patient_id: String(rx.patient_id),
      dentist_id: String(rx.dentist_id),
      prescription_date: rx.prescription_date,
      additional_instructions: rx.additional_instructions || '',
      items: rx.items.map((i) => ({
        medication_name: i.medication_name,
        dosage: i.dosage,
        frequency: i.frequency,
        duration: i.duration,
      })),
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        patient_id: Number(form.patient_id),
        dentist_id: Number(form.dentist_id),
        prescription_date: form.prescription_date,
        additional_instructions: form.additional_instructions,
        items: form.items,
      };
      if (editingRx) {
        await apiRequest(`/api/prescriptions/${editingRx.id}`, { method: 'PUT', body: payload });
        onNotify('success', `Prescription ${editingRx.prescription_code} updated.`);
      } else {
        await apiRequest('/api/prescriptions', { method: 'POST', body: payload });
        onNotify('success', 'Prescription issued.');
      }
      setFormOpen(false);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save prescription.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/prescriptions/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify('success', `Deleted prescription ${deleteTarget.prescription_code}.`);
      setDeleteTarget(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete prescription.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prescriptions.filter(
      (rx) =>
        !q ||
        rx.patient_name.toLowerCase().includes(q) ||
        rx.dentist_name.toLowerCase().includes(q) ||
        rx.prescription_code.toLowerCase().includes(q) ||
        rx.items.some((i) => i.medication_name.toLowerCase().includes(q))
    );
  }, [prescriptions, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Prescriptions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create, edit, and print clinical medication orders for dental patients.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Prescription</span>
        </button>
      </div>

      {/* Printable Preview Sheet (if active) */}
      {printRx && (
        <div className="bg-white border border-slate-300 rounded-xl p-8 print-surface space-y-6">
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">
                {clinicSettings?.clinic_name || 'ClarityDental Studio'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">{clinicSettings?.address}</p>
              <p className="text-xs text-slate-600">
                {clinicSettings?.phone} · {clinicSettings?.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono font-semibold text-teal-800">{printRx.prescription_code}</p>
              <p className="text-xs font-mono text-slate-600 mt-1">Date: {printRx.prescription_date}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
            <div>
              <p className="text-slate-500">Patient</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {printRx.patient_name} ({printRx.patient_code})
              </p>
              <p className="text-slate-600 mt-0.5">
                DOB: {printRx.patient_dob || '—'} · Phone: {printRx.patient_phone || '—'}
              </p>
              <p className="text-red-700 font-medium mt-0.5">
                Allergies: {printRx.patient_allergies || 'None reported'}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-slate-500">Prescribing Clinician</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{printRx.dentist_name}</p>
              <p className="text-slate-600 mt-0.5">{printRx.dentist_specialization}</p>
              <p className="text-slate-600 font-mono mt-0.5">License: {printRx.dentist_license}</p>
            </div>
          </div>

          <div>
            <p className="text-lg font-display font-semibold text-slate-900 mb-3">Rx</p>
            <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Medication</th>
                  <th className="py-2.5 px-4 font-medium">Dosage</th>
                  <th className="py-2.5 px-4 font-medium">Frequency</th>
                  <th className="py-2.5 px-4 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {printRx.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{item.medication_name}</td>
                    <td className="py-2.5 px-4 text-slate-700">{item.dosage}</td>
                    <td className="py-2.5 px-4 text-slate-700">{item.frequency}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{item.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {printRx.additional_instructions && (
            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="font-semibold text-slate-900">Additional Instructions:</span>{' '}
              {printRx.additional_instructions}
            </div>
          )}

          <div className="pt-8 flex items-end justify-between border-t border-slate-200 text-xs text-slate-500">
            <div>
              <p>Clinic stamp & licensed prescriber signature required for dispensing.</p>
            </div>
            <div className="text-right">
              <div className="w-48 border-b border-slate-400 mb-1" />
              <p className="font-medium text-slate-800">{printRx.dentist_name}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 no-print">
            <button
              type="button"
              onClick={() => setPrintRx(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Close Print View
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
            >
              <Printer className="w-4 h-4" />
              <span>Print Prescription</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 no-print">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Rx ID, patient, dentist, or medication..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-medium">Rx ID</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Patient</th>
                <th className="py-3 px-4 font-medium">Prescriber</th>
                <th className="py-3 px-4 font-medium">Medications</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4">
                    <EmptyState
                      title="No prescriptions found"
                      description="Create a new prescription to view and print patient medication orders."
                      actionLabel="New Prescription"
                      onAction={openNew}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((rx) => (
                  <tr key={rx.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {rx.prescription_code}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {rx.prescription_date}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{rx.patient_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{rx.patient_code}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{rx.dentist_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {rx.items.map((item, idx) => (
                        <div key={idx}>
                          <span className="font-medium">{item.medication_name}</span> · {item.dosage} ·{' '}
                          {item.frequency} ({item.duration})
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPrintRx(rx)}
                          title="View & Print Prescription"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(rx)}
                          title="Edit Prescription"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rx)}
                          title="Delete Prescription"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Prescription Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingRx ? `Edit Prescription · ${editingRx.prescription_code}` : 'New Prescription'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prescribing Dentist <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={form.dentist_id}
                onChange={(e) => setForm((f) => ({ ...f, dentist_id: e.target.value }))}
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
                Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={form.prescription_date}
                onChange={(e) => setForm((f) => ({ ...f, prescription_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">Medications</p>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    items: [...f.items, { medication_name: '', dosage: '', frequency: '', duration: '' }],
                  }))
                }
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                + Add Medication
              </button>
            </div>

            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  required
                  placeholder="Medication name"
                  value={item.medication_name}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[idx] = { ...next[idx], medication_name: e.target.value };
                    setForm((f) => ({ ...f, items: next }));
                  }}
                  className="sm:col-span-4 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Dosage (e.g. 500 mg)"
                  value={item.dosage}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[idx] = { ...next[idx], dosage: e.target.value };
                    setForm((f) => ({ ...f, items: next }));
                  }}
                  className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Frequency"
                  value={item.frequency}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[idx] = { ...next[idx], frequency: e.target.value };
                    setForm((f) => ({ ...f, items: next }));
                  }}
                  className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <div className="sm:col-span-2 flex items-center gap-1">
                  <input
                    type="text"
                    required
                    placeholder="Duration"
                    value={item.duration}
                    onChange={(e) => {
                      const next = [...form.items];
                      next[idx] = { ...next[idx], duration: e.target.value };
                      setForm((f) => ({ ...f, items: next }));
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                      }
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      aria-label="Remove medication"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Additional Instructions</label>
            <textarea
              rows={2}
              value={form.additional_instructions}
              onChange={(e) => setForm((f) => ({ ...f, additional_instructions: e.target.value }))}
              placeholder="Take after meals, avoid alcohol, etc."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Prescription'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Prescription"
        message={`Delete prescription ${deleteTarget?.prescription_code} for ${deleteTarget?.patient_name}?`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
