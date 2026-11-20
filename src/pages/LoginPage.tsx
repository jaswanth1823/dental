import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { apiRequest, setCsrfToken } from '../api/client';
import type { AuthUser } from '../types/dcms';
import { Modal } from '../components/ui/Primitives';

const DEMO_ACCOUNTS = [
  {
    role: 'Administrator',
    identifier: 'admin',
    password: 'Admin@123',
    description: 'Full clinic, staff, billing & settings access',
  },
  {
    role: 'Dentist',
    identifier: 'elena.vance',
    password: 'Dentist@123',
    description: 'Patients, dental exams, treatment plans & Rx',
  },
  {
    role: 'Receptionist',
    identifier: 'reception',
    password: 'Reception@123',
    description: 'Registrations, scheduling & billing payments',
  },
];

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) {
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your email or username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ user: AuthUser; csrfToken: string }>('/api/auth/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password, rememberMe },
      });
      setCsrfToken(res.csrfToken);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail },
      });
      setForgotMessage(res.message);
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : 'Unable to process request.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch shadow-sm">
        {/* Left Visual Column */}
        <div className="lg:col-span-6 relative bg-slate-900 min-h-[240px] lg:min-h-[620px] flex flex-col justify-end overflow-hidden">
          <img
            src="/src/assets/images/clinic_login_interior_1795166175005.jpg"
            alt="ClarityDental modern clinic interior"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/45 to-slate-900/15" />
          <div className="relative z-10 p-8 text-white">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-600 text-white font-display font-bold text-sm flex items-center justify-center">
                CD
              </div>
              <span className="font-display font-semibold text-lg tracking-tight">ClarityDental</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold leading-tight text-balance">
              Precision clinical records, scheduling, and billing in one workspace.
            </h1>
            <p className="mt-3 text-sm text-slate-200 leading-relaxed max-w-md">
              Built for dental reception teams, licensed practitioners, and clinic administrators.
            </p>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <h2 className="text-xl font-display font-semibold text-slate-900">Sign in to your clinic workspace</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your staff credentials or select a demo role below.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email or Username <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin or elena.vance@claritydental.example.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>Remember me for 30 days</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setForgotMessage('');
                    setForgotOpen(true);
                  }}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Demo Roles Quick Selector */}
            <div className="mt-7 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2.5">Demo Role Quick Fill</p>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => {
                      setIdentifier(acc.identifier);
                      setPassword(acc.password);
                      setError('');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-teal-600 hover:bg-teal-50/40 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{acc.role}</p>
                      <p className="text-[11px] text-slate-500 truncate">{acc.description}</p>
                    </div>
                    <span className="text-[11px] font-mono text-teal-700 shrink-0">
                      {acc.identifier} / {acc.password}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Password Recovery"
        subtitle="Request a password reset from your clinic administrator."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          {forgotMessage && (
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900">
              {forgotMessage}
            </div>
          )}
          <div>
            <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-700 mb-1.5">
              Staff Email Address <span className="text-red-600">*</span>
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@claritydental.example.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={forgotLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {forgotLoading ? 'Sending...' : 'Request Reset'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
