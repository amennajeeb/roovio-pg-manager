import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wrench,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { DemoNotice } from '../common/DemoNotice';
import { RoovioLogo } from '../common/RoovioLogo';
import { useData } from '../../persistence/DataContext';
import { useAuth } from '../../persistence/AuthContext';

export const Sidebar: React.FC = () => {
  const { state, properties, activePropertyId, setActiveBuilding } = useData();
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Home Dashboard', icon: LayoutDashboard },
    { to: '/building', label: 'Building & Beds', icon: Building2 },
    { to: '/tenants', label: 'Tenants & Dues', icon: Users },
    { to: '/facilities', label: 'Facilities & Tickets', icon: Wrench },
    { to: '/expenses', label: 'Expenses & Cash Flow', icon: ReceiptIndianRupee },
    { to: '/settings', label: 'Settings & Backup', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 shrink-0">
      {/* Brand & Property */}
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <div className="flex flex-col gap-1">
          <RoovioLogo size="md" className="py-0.5" />
          <p className="text-[11px] text-slate-500 font-medium">Operations Dashboard</p>
        </div>

        {/* Property Card */}
        <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span className="truncate">{state.property.name}</span>
            </div>
            {state.property.isArchived && (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded">Archived</span>
            )}
          </div>
          {properties.length > 1 ? (
            <select
              value={activePropertyId || state.property.id}
              onChange={(e) => setActiveBuilding(e.target.value)}
              className="mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Select active building"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isArchived ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {state.property.city}
            </p>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Owner Session & Sign Out */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {user?.name || 'PG Owner'}
              </p>
              <p className="text-[10px] text-slate-400 truncate font-mono">
                {user?.email || 'owner@roovio.in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            title="Sign Out of PG Dashboard"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Persistent Demo Notice */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <DemoNotice className="w-full justify-center text-center" />
      </div>
    </aside>
  );
};

