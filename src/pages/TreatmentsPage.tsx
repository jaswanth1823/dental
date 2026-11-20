import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import type { AuthUser, Dentist, Patient, Treatment, TreatmentPlan } from '../types/dcms';
import { ConfirmDialog, EmptyState, Modal, StatusTag, formatCurrency } from '../components/ui/Primitives';

export function TreatmentsPage({
  user,
  treatments,
  plans,
  patients,
  dentists,
  openAddOnMount,
  onClearOpenAdd,
  onRefreshData,
  onNotify,
}: {
  user: AuthUser;
  treatments: Treatment[];
  plans: TreatmentPlan[];
  patients: Patient[];
  dentists: Dentist[];
  openAddOnMount: boolean;
  onClearOpenAdd: () => void;
  onRefreshData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const [tab, setTab] = useState<'catalog' | 'plans'>('catalog');
  const [search, setSearch] = useState('');

  // Treatment Catalog Modal
  const [trtOpen, setTrtOpen] = useState(false);
  const [editingTrt, setEditingTrt] = useState<Treatment | null>(null);
  const [trtSaving, setTrtSaving] = useState(false);
  const [trtForm, setTrtForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    cost: 120,
    status: 'Active' as 'Active' | 'Archived',
  });

  // Delete Treatment
  const [deleteTrt, setDeleteTrt] = useState<Treatment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Treatment Plan Modal
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planForm, setPlanForm] = useState({
    patient_id: '',
    dentist_id: '',
    treatment_id: '',
    diagnosis: '',
    treatment_notes: '',
    estimated_cost: 0,
    start_date: new Date().toISOString().slice(0, 10),
    status: 'Planned' as TreatmentPlan['status'],
  });

  useEffect(() => {
    if (openAddOnMount) {
      openNewTreatment();
      onClearOpenAdd();
    }
  }, [openAddOnMount]);

  const openNewTreatment = () => {
    setEditingTrt(null);
    setTrtForm({ name: '', description: '', duration_minutes: 30, cost: 120, status: 'Active' });
    setTrtOpen(true);
  };

  const openEditTreatment = (t: Treatment) => {
    setEditingTrt(t);
    setTrtForm({
      name: t.name,
      description: t.description,
      duration_minutes: t.duration_minutes,
      cost: t.cost,
      status: t.status,
    });
    setTrtOpen(true);
  };

  const openAssignPlan = (treatment?: Treatment) => {
    const trt = treatment || treatments[0];
    setPlanForm({
      patient_id: String(patients[0]?.id || ''),
      dentist_id: String(user.dentist_id || dentists[0]?.id || ''),
      treatment_id: String(trt?.id || ''),
      diagnosis: '',
      treatment_notes: '',
      estimated_cost: trt ? trt.cost : 0,
      start_date: new Date().toISOString().slice(0, 10),
      status: 'Planned',
    });
    setPlanOpen(true);
  };

  const handleSaveTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrtSaving(true);
    try {
      if (editingTrt) {
        await apiRequest(`/api/treatments/${editingTrt.id}`, { method: 'PUT', body: trtForm });
        onNotify('success', `Updated treatment ${trtForm.name}.`);
      } else {
        await apiRequest('/api/treatments', { method: 'POST', body: trtForm });
        onNotify('success', `Added treatment ${trtForm.name}.`);
      }
      setTrtOpen(false);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save treatment.');
    } finally {
      setTrtSaving(false);
    }
  };

  const handleDeleteTreatment = async () => {
    if (!deleteTrt) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/treatments/${deleteTrt.id}`, { method: 'DELETE' });
      onNotify('success', `Deleted treatment ${deleteTrt.name}.`);
      setDeleteTrt(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete treatment.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanSaving(true);
    try {
      await apiRequest('/api/treatment-plans', {
        method: 'POST',
        body: {
          ...planForm,
          patient_id: Number(planForm.patient_id),
          dentist_id: Number(planForm.dentist_id),
          treatment_id: Number(planForm.treatment_id),
          estimated_cost: Number(planForm.estimated_cost),
        },
      });
      onNotify('success', 'Patient treatment plan created.');
      setPlanOpen(false);
      setTab('plans');
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to create treatment plan.');
    } finally {
      setPlanSaving(false);
    }
  };

  const handlePlanStatus = async (plan: TreatmentPlan, status: TreatmentPlan['status']) => {
    try {
      await apiRequest(`/api/treatment-plans/${plan.id}`, {
        method: 'PUT',
        body: { status },
      });
      onNotify('success', `Plan ${plan.plan_code} updated to ${status}.`);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update treatment plan.');
    }
  };

  const filteredTreatments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return treatments.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.treatment_code.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [treatments, search]);

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter(
      (p) =>
        !q ||
        p.patient_name.toLowerCase().includes(q) ||
        p.treatment_name.toLowerCase().includes(q) ||
        p.diagnosis.toLowerCase().includes(q) ||
        p.plan_code.toLowerCase().includes(q)
    );
  }, [plans, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Treatments & Care Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Clinic procedure catalog, fee schedule, and patient-specific treatment plans.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('catalog')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Treatment Catalog ({treatments.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('plans')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'plans' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Treatment Plans ({plans.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => openAssignPlan()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            <ClipboardPlus className="w-4 h-4 text-teal-700" />
            <span>Assign Treatment Plan</span>
          </button>

          <button
            type="button"
            onClick={openNewTreatment}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Treatment</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'catalog' ? 'Search treatment catalog...' : 'Search patient treatment plans...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
          />
        </div>
      </div>

      {tab === 'catalog' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Treatment Name</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Duration</th>
                  <th className="py-3 px-4 font-medium text-right">Fee</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTreatments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-4">
                      <EmptyState
                        title="No treatments found"
                        description="Add a treatment procedure to build your clinic fee schedule."
                        actionLabel="Add Treatment"
                        onAction={openNewTreatment}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredTreatments.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {t.treatment_code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{t.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-md">{t.description}</td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {t.duration_minutes} min
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatCurrency(t.cost)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusTag status={t.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openAssignPlan(t)}
                            title="Assign to Patient"
                            className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md whitespace-nowrap"
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditTreatment(t)}
                            title="Edit Treatment"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {user.role === 'Administrator' && (
                            <button
                              type="button"
                              onClick={() => setDeleteTrt(t)}
                              title="Delete Treatment"
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
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Plan ID</th>
                  <th className="py-3 px-4 font-medium">Patient</th>
                  <th className="py-3 px-4 font-medium">Dentist</th>
                  <th className="py-3 px-4 font-medium">Treatment & Diagnosis</th>
                  <th className="py-3 px-4 font-medium">Start Date</th>
                  <th className="py-3 px-4 font-medium text-right">Est. Cost</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{p.plan_code}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.patient_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{p.dentist_name}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-slate-900">{p.treatment_name}</p>
                      <p className="text-xs text-slate-500">{p.diagnosis}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">{p.start_date}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatCurrency(p.estimated_cost)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusTag status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        aria-label={`Change status for ${p.plan_code}`}
                        value={p.status}
                        onChange={(e) => handlePlanStatus(p, e.target.value as TreatmentPlan['status'])}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                      >
                        <option value="Planned">Planned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Treatment Modal */}
      <Modal
        open={trtOpen}
        onClose={() => setTrtOpen(false)}
        title={editingTrt ? `Edit Treatment · ${editingTrt.treatment_code}` : 'Add Treatment'}
      >
        <form onSubmit={handleSaveTreatment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Treatment Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={trtForm.name}
              onChange={(e) => setTrtForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={trtForm.description}
              onChange={(e) => setTrtForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Duration (min)</label>
              <input
                type="number"
                min={10}
                step={5}
                required
                value={trtForm.duration_minutes}
                onChange={(e) => setTrtForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fee ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={trtForm.cost}
                onChange={(e) => setTrtForm((f) => ({ ...f, cost: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={trtForm.status}
                onChange={(e) => setTrtForm((f) => ({ ...f, status: e.target.value as 'Active' | 'Archived' }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTrtOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={trtSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {trtSaving ? 'Saving...' : 'Save Treatment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Treatment Plan Modal */}
      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Create Patient Treatment Plan"
      >
        <form onSubmit={handleSavePlan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={planForm.patient_id}
                onChange={(e) => setPlanForm((f) => ({ ...f, patient_id: e.target.value }))}
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
                value={planForm.dentist_id}
                onChange={(e) => setPlanForm((f) => ({ ...f, dentist_id: e.target.value }))}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Treatment <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={planForm.treatment_id}
                onChange={(e) => {
                  const trt = treatments.find((t) => String(t.id) === e.target.value);
                  setPlanForm((f) => ({
                    ...f,
                    treatment_id: e.target.value,
                    estimated_cost: trt ? trt.cost : f.estimated_cost,
                  }));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatCurrency(t.cost)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Cost ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={planForm.estimated_cost}
                onChange={(e) => setPlanForm((f) => ({ ...f, estimated_cost: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Diagnosis <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={planForm.diagnosis}
              onChange={(e) => setPlanForm((f) => ({ ...f, diagnosis: e.target.value }))}
              placeholder="Clinician-entered diagnosis"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={planForm.start_date}
                onChange={(e) => setPlanForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={planForm.status}
                onChange={(e) => setPlanForm((f) => ({ ...f, status: e.target.value as TreatmentPlan['status'] }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Treatment Notes</label>
            <textarea
              rows={2}
              value={planForm.treatment_notes}
              onChange={(e) => setPlanForm((f) => ({ ...f, treatment_notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPlanOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={planSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {planSaving ? 'Saving...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTrt)}
        title="Delete Treatment"
        message={`Delete "${deleteTrt?.name}" from the catalog? If it is linked to existing appointments, archive it instead.`}
        loading={deleting}
        onConfirm={handleDeleteTreatment}
        onCancel={() => setDeleteTrt(null)}
      />
    </div>
  );
}
