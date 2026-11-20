import React, { useEffect, useState } from 'react';
import { Database, Download, Upload } from 'lucide-react';
import { apiRequest } from '../api/client';
import type { AuthUser, ClinicSettings } from '../types/dcms';

export function SettingsPage({
  user,
  clinicSettings,
  onRefreshSettings,
  onRefreshUser,
  onNotify,
}: {
  user: AuthUser;
  clinicSettings: ClinicSettings | null;
  onRefreshSettings: () => Promise<void>;
  onRefreshUser: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const isAdmin = user.role === 'Administrator';

  const [clinicForm, setClinicForm] = useState({
    clinic_name: '',
    address: '',
    phone: '',
    email: '',
    working_hours: '',
    tax_rate: 5,
    logo_url: '',
  });
  const [savingClinic, setSavingClinic] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: user.full_name,
    notif_appointments: user.notif_appointments === 1,
    notif_followups: user.notif_followups === 1,
    notif_billing: user.notif_billing === 1,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (clinicSettings) {
      setClinicForm({
        clinic_name: clinicSettings.clinic_name,
        address: clinicSettings.address,
        phone: clinicSettings.phone,
        email: clinicSettings.email,
        working_hours: clinicSettings.working_hours,
        tax_rate: clinicSettings.tax_rate,
        logo_url: clinicSettings.logo_url || '',
      });
    }
  }, [clinicSettings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      onNotify('error', 'Logo image must be under 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setClinicForm((f) => ({ ...f, logo_url: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClinic(true);
    try {
      await apiRequest('/api/settings', { method: 'PUT', body: clinicForm });
      onNotify('success', 'Clinic settings saved.');
      await onRefreshSettings();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save clinic settings.');
    } finally {
      setSavingClinic(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: {
          full_name: profileForm.full_name,
          notif_appointments: profileForm.notif_appointments ? 1 : 0,
          notif_followups: profileForm.notif_followups ? 1 : 0,
          notif_billing: profileForm.notif_billing ? 1 : 0,
        },
      });
      onNotify('success', 'Profile & notification preferences updated.');
      await onRefreshUser();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      onNotify('error', 'New password and confirmation do not match.');
      return;
    }
    setSavingPwd(true);
    try {
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: {
          currentPassword: pwdForm.currentPassword,
          newPassword: pwdForm.newPassword,
        },
      });
      onNotify('success', 'Password changed successfully.');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleBackupDownload = async () => {
    try {
      const data = await apiRequest<Record<string, unknown>>('/api/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claritydental-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('success', 'Database backup exported.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Backup export failed.');
    }
  };

  const handleSourceZipDownload = async () => {
    try {
      const res = await fetch('/api/export-source', { credentials: 'include' });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'Unable to export source archive.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'claritydental-dcms-source.zip';
      a.click();
      URL.revokeObjectURL(url);
      onNotify('success', 'Source code archive (claritydental-dcms-source.zip) downloaded.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Source archive download failed.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Clinic profile, account preferences, password security, and database backup.
        </p>
      </div>

      {/* Clinic Settings (Admin Editable, Read-only for others) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Clinic Information</h2>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'Displayed on printable prescriptions, billing invoices, and workspace navigation.'
                : 'Managed by clinic administrators.'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSourceZipDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Source (.zip)</span>
              </button>
              <button
                type="button"
                onClick={handleBackupDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5 text-teal-700" />
                <span>Export DB Backup</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveClinic} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Clinic Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                required
                value={clinicForm.clinic_name}
                onChange={(e) => setClinicForm((f) => ({ ...f, clinic_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Clinic Email</label>
              <input
                type="email"
                disabled={!isAdmin}
                required
                value={clinicForm.email}
                onChange={(e) => setClinicForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                disabled={!isAdmin}
                required
                value={clinicForm.phone}
                onChange={(e) => setClinicForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Default Invoice Tax (%)</label>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={clinicForm.tax_rate}
                onChange={(e) => setClinicForm((f) => ({ ...f, tax_rate: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              disabled={!isAdmin}
              required
              value={clinicForm.address}
              onChange={(e) => setClinicForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Working Hours</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={clinicForm.working_hours}
              onChange={(e) => setClinicForm((f) => ({ ...f, working_hours: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5" />
                <span>{clinicForm.logo_url ? 'Replace Clinic Logo' : 'Upload Clinic Logo'}</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>

              <button
                type="submit"
                disabled={savingClinic}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
              >
                {savingClinic ? 'Saving...' : 'Save Clinic Info'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Profile & Notification Preferences */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Profile & Notification Preferences</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profileForm.full_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Account Role</label>
              <input
                type="text"
                disabled
                value={`${user.role} (${user.email})`}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.notif_appointments}
                onChange={(e) => setProfileForm((f) => ({ ...f, notif_appointments: e.target.checked }))}
                className="rounded border-slate-300 text-teal-700"
              />
              <span>Notify on new & cancelled appointments</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.notif_followups}
                onChange={(e) => setProfileForm((f) => ({ ...f, notif_followups: e.target.checked }))}
                className="rounded border-slate-300 text-teal-700"
              />
              <span>Notify on upcoming patient follow-ups</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.notif_billing}
                onChange={(e) => setProfileForm((f) => ({ ...f, notif_billing: e.target.checked }))}
                className="rounded border-slate-300 text-teal-700"
              />
              <span>Notify on invoice payment reminders</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </section>

      {/* Password Change */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm((f) => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPwd}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {savingPwd ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
