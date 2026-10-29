import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wrench,
  ReceiptIndianRupee,
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const tabs = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/building', label: 'Building', icon: Building2 },
    { to: '/tenants', label: 'Tenants', icon: Users },
    { to: '/facilities', label: 'Facilities', icon: Wrench },
    { to: '/expenses', label: 'Expenses', icon: ReceiptIndianRupee },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
                  isActive
                    ? 'text-brand-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-1 tracking-tight truncate px-1">
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

