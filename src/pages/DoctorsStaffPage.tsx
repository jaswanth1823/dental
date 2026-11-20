import React, { useMemo, useState } from 'react';
import { CalendarPlus, Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import type { AuthUser, StaffMember, UserRole } from '../types/dcms';
import { Avatar, ConfirmDialog, Modal, StatusTag } from '../components/ui/Primitives';

export function DoctorsStaffPage({
  user,
  staff,
  onRefreshData,
  onNotify,
  onAssignAppointment,
}: {
  user: AuthUser;
  staff: StaffMember[];
  onRefreshData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onAssignAppointment: () => void;
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');

  const [viewingMember, setViewingMember] = useState<StaffMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    role: 'Dentist' as UserRole,
    phone: '',
    email: '',
    working_hours: 'Mon–Fri 09:00–17:00',
    status: 'Active' as 'Active' | 'On Leave' | 'Inactive',
    specialization: '',
    license_number: '',
    bio: '',
    available_days: 'Mon,Tue,Wed,Thu,Fri',
    start_hour: '09:00',
    end_hour: '17:00',
    username: '',
    password: '',
  });

  const isAdmin = user.role === 'Administrator';

  const openNewModal = () => {
    setEditingMember(null);
    setFormError('');
    setForm({
      full_name: '',
      role: 'Dentist',
      phone: '',
      email: '',
      working_hours: 'Mon–Fri 09:00–17:00',
      status: 'Active',
      specialization: '',
      license_number: '',
      bio: '',
      available_days: 'Mon,Tue,Wed,Thu,Fri',
      start_hour: '09:00',
      end_hour: '17:00',
      username: '',
      password: '',
    });
    setFormOpen(true);
  };

  const openEditModal = (m: StaffMember) => {
    setEditingMember(m);
    setFormError('');
    setForm({
      full_name: m.full_name,
      role: m.role,
      phone: m.phone,
      email: m.email,
      working_hours: m.working_hours,
      status: m.status,
      specialization: m.specialization || '',
      license_number: m.license_number || '',
      bio: m.bio || '',
      available_days: m.available_days || 'Mon,Tue,Wed,Thu,Fri',
      start_hour: m.start_hour || '09:00',
      end_hour: m.end_hour || '17:00',
      username: '',
      password: '',
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingMember) {
        await apiRequest(`/api/staff/${editingMember.id}`, { method: 'PUT', body: form });
        onNotify('success', `Updated profile for ${form.full_name}.`);
      } else {
        await apiRequest('/api/staff', { method: 'POST', body: form });
        onNotify('success', `Added ${form.full_name} to clinic roster.`);
      }
      setFormOpen(false);
      await onRefreshData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/staff/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify('success', `Removed ${deleteTarget.full_name} from clinic roster.`);
      setDeleteTarget(null);
      await onRefreshData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to delete staff member.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((m) => {
      if (roleFilter !== 'All' && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.staff_code.toLowerCase().includes(q) ||
        (m.specialization || '').toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });
  }, [staff, search, roleFilter]);

  const dentistsOnly = filtered.filter((m) => m.role === 'Dentist');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">Doctors & Staff</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Clinical practitioners, specializations, availability schedules, and front-desk team.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff / Dentist</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or specialization..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
          />
        </div>

        <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
          {(['All', 'Dentist', 'Receptionist', 'Administrator'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                roleFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r === 'All' ? 'All Roles' : `${r}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Dentist Cards */}
      {dentistsOnly.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Practicing Dentists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {dentistsOnly.map((doc) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Avatar src={doc.avatar_url} name={doc.full_name} size="lg" />
                    <StatusTag status={doc.status} />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-semibold text-slate-900">{doc.full_name}</h3>
                    <p className="text-xs font-medium text-teal-700 mt-0.5">{doc.specialization}</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      {doc.staff_code} · {doc.license_number}
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                    <p className="font-mono tabular-nums">{doc.working_hours}</p>
                    <p className="font-mono tabular-nums">{doc.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setViewingMember(doc)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                  >
                    View Profile
                  </button>
                  <button
                    type="button"
                    onClick={onAssignAppointment}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg whitespace-nowrap"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Assign</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Staff Directory Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Complete Staff Roster ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-medium">Staff ID</th>
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Role / Specialization</th>
                <th className="py-3 px-4 font-medium">Contact</th>
                <th className="py-3 px-4 font-medium">Working Hours</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{m.staff_code}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={m.avatar_url} name={m.full_name} size="sm" />
                      <span className="font-medium text-slate-900">{m.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    <span className="font-medium">{m.role}</span>
                    {m.specialization && <span className="text-slate-500"> · {m.specialization}</span>}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <p className="font-mono tabular-nums text-slate-700">{m.phone}</p>
                    <p className="text-slate-500">{m.email}</p>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{m.working_hours}</td>
                  <td className="py-3 px-4">
                    <StatusTag status={m.status} />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingMember(m)}
                        title="View Profile"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(m)}
                            title="Edit & Manage Availability"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(m)}
                            title="Delete Staff"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* View Staff Profile Modal */}
      <Modal
        open={Boolean(viewingMember)}
        onClose={() => setViewingMember(null)}
        title={viewingMember?.full_name || 'Staff Profile'}
        subtitle={viewingMember ? `${viewingMember.staff_code} · ${viewingMember.role}` : undefined}
      >
        {viewingMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={viewingMember.avatar_url} name={viewingMember.full_name} size="lg" />
              <div>
                <p className="text-base font-semibold text-slate-900">{viewingMember.full_name}</p>
                <p className="text-xs text-teal-700 font-medium">
                  {viewingMember.specialization || viewingMember.role}
                </p>
                {viewingMember.license_number && (
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    License: {viewingMember.license_number}
                  </p>
                )}
              </div>
            </div>

            {viewingMember.bio && <p className="text-sm text-slate-600 leading-relaxed">{viewingMember.bio}</p>}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-3 border-t border-slate-200">
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="text-slate-900">{viewingMember.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="text-slate-900 font-mono">{viewingMember.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Working Hours</dt>
                <dd className="text-slate-900 font-mono">{viewingMember.working_hours}</dd>
              </div>
              {viewingMember.available_days && (
                <div>
                  <dt className="text-xs text-slate-500">Available Days & Hours</dt>
                  <dd className="text-slate-900 font-mono">
                    {viewingMember.available_days} ({viewingMember.start_hour}–{viewingMember.end_hour})
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Modal>

      {/* Add / Edit Staff Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingMember ? `Edit Staff · ${editingMember.staff_code}` : 'Add Dentist or Staff Member'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
              <select
                disabled={Boolean(editingMember)}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                <option value="Dentist">Dentist</option>
                <option value="Receptionist">Receptionist</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
                Working Hours Label <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.working_hours}
                onChange={(e) => setForm((f) => ({ ...f, working_hours: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as 'Active' | 'On Leave' | 'Inactive' }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {form.role === 'Dentist' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Specialization <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.specialization}
                    onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                    placeholder="e.g. Prosthodontics"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    License Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.license_number}
                    onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
                    placeholder="e.g. DDS-WA-60120"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Available Days</label>
                  <input
                    type="text"
                    value={form.available_days}
                    onChange={(e) => setForm((f) => ({ ...f, available_days: e.target.value }))}
                    placeholder="Mon,Tue,Wed,Thu,Fri"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Shift Start</label>
                  <input
                    type="time"
                    value={form.start_hour}
                    onChange={(e) => setForm((f) => ({ ...f, start_hour: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Shift End</label>
                  <input
                    type="time"
                    value={form.end_hour}
                    onChange={(e) => setForm((f) => ({ ...f, end_hour: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </>
          )}

          {!editingMember && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Login Username (optional)</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="Creates user login account"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}

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
              {saving ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove Staff Member"
        message={`Remove ${deleteTarget?.full_name} (${deleteTarget?.staff_code}) from the clinic roster?`}
        confirmLabel="Remove Staff"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
