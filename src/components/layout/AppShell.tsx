import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import type { AppNotification, AuthUser, ClinicSettings, Patient } from '../../types/dcms';
import { Avatar } from '../ui/Primitives';

export type NavSection =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'doctors'
  | 'treatments'
  | 'prescriptions'
  | 'billing'
  | 'reports'
  | 'settings';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<AuthUser['role']>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Administrator', 'Dentist', 'Receptionist'] },
  { id: 'patients', label: 'Patients', icon: Users, roles: ['Administrator', 'Dentist', 'Receptionist'] },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, roles: ['Administrator', 'Dentist', 'Receptionist'] },
  { id: 'doctors', label: 'Doctors & Staff', icon: Stethoscope, roles: ['Administrator', 'Dentist', 'Receptionist'] },
  { id: 'treatments', label: 'Treatments', icon: ClipboardList, roles: ['Administrator', 'Dentist'] },
  { id: 'prescriptions', label: 'Prescriptions', icon: FileText, roles: ['Administrator', 'Dentist'] },
  { id: 'billing', label: 'Billing & Payments', icon: CreditCard, roles: ['Administrator', 'Receptionist'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['Administrator', 'Dentist', 'Receptionist'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['Administrator', 'Dentist', 'Receptionist'] },
];

export function AppShell({
  user,
  clinicSettings,
  activeSection,
  breadcrumbs,
  notifications,
  patientsForSearch,
  onNavigate,
  onSelectPatientFromSearch,
  onMarkNotificationRead,
  onMarkAllRead,
  onLogout,
  children,
}: {
  user: AuthUser;
  clinicSettings: ClinicSettings | null;
  activeSection: NavSection;
  breadcrumbs: string[];
  notifications: AppNotification[];
  patientsForSearch: Patient[];
  onNavigate: (section: NavSection) => void;
  onSelectPatientFromSearch: (patientId: number) => void;
  onMarkNotificationRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  const matchedPatients = globalQuery.trim()
    ? patientsForSearch
        .filter(
          (p) =>
            p.full_name.toLowerCase().includes(globalQuery.toLowerCase()) ||
            p.patient_code.toLowerCase().includes(globalQuery.toLowerCase()) ||
            p.phone.includes(globalQuery)
        )
        .slice(0, 5)
    : [];

  const matchedNav = globalQuery.trim()
    ? visibleNav.filter((n) => n.label.toLowerCase().includes(globalQuery.toLowerCase()))
    : [];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-5 h-16 flex items-center gap-3 border-b border-slate-200 shrink-0">
        {clinicSettings?.logo_url ? (
          <img
            src={clinicSettings.logo_url}
            alt={clinicSettings.clinic_name}
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
            CD
          </div>
        )}
        <span className="font-display font-semibold text-base tracking-tight text-slate-900 truncate">
          {clinicSettings?.clinic_name || 'ClarityDental'}
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-teal-50 text-teal-800 border border-teal-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
        <p className="font-medium text-slate-700 truncate">{user.full_name}</p>
        <p className="mt-0.5 truncate">
          {user.role} · {user.username}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFB] text-slate-900">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 fixed inset-y-0 left-0 z-30 no-print">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 z-20"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[248px] flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb}-${idx}`}>
                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span
                      className={`truncate ${
                        isLast ? 'font-semibold text-slate-900' : 'text-slate-500 hidden sm:inline'
                      }`}
                    >
                      {crumb}
                    </span>
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Global Search */}
            <div ref={searchRef} className="relative hidden md:block w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Search patients or modules..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 focus:bg-white transition-colors"
              />
              {searchFocused && globalQuery.trim() && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-40">
                  {matchedPatients.length > 0 && (
                    <div className="px-3 py-1">
                      <p className="text-xs font-medium text-slate-400 mb-1">Patients</p>
                      {matchedPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSelectPatientFromSearch(p.id);
                            setGlobalQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-medium text-slate-900 truncate">{p.full_name}</span>
                          <span className="text-xs font-mono text-slate-500 shrink-0">{p.patient_code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedNav.length > 0 && (
                    <div className="px-3 py-1 border-t border-slate-100 mt-1 pt-2">
                      <p className="text-xs font-medium text-slate-400 mb-1">Modules</p>
                      {matchedNav.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onNavigate(m.id);
                            setGlobalQuery('');
                            setSearchFocused(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedPatients.length === 0 && matchedNav.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500">No matching patients or modules found.</p>
                  )}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-md bg-teal-700 text-white text-[10px] font-mono font-semibold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-slate-500 text-center">No notifications.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            onMarkNotificationRead(n.id);
                            if (n.related_link) {
                              onNavigate(n.related_link as NavSection);
                            }
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            n.is_read === 0 ? 'bg-teal-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {n.is_read === 0 ? 'Unread' : 'Read'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              >
                <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-900 leading-tight whitespace-nowrap">
                    {user.full_name}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight whitespace-nowrap">{user.role}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('settings');
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Viewport Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
