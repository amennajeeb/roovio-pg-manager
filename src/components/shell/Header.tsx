import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Settings as SettingsIcon, Plus, WifiOff, LogOut, ChevronDown } from 'lucide-react';
import { useData } from '../../persistence/DataContext';
import { useAuth } from '../../persistence/AuthContext';
import { formatBillingMonth } from '../../utils/date';
import { DemoNotice } from '../common/DemoNotice';
import { RoovioLogo } from '../common/RoovioLogo';

interface HeaderProps {
  onOpenOnboard?: () => void;
  onOpenRecordPayment?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenOnboard }) => {
  const { state, setSelectedMonth, properties, activePropertyId, setActiveBuilding } = useData();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/building':
        return 'Building & Beds';
      case '/tenants':
        return 'Tenants & Dues';
      case '/facilities':
        return 'Facilities & Repairs';
      case '/expenses':
        return 'Cash Flow';
      case '/settings':
        return 'Settings';
      default:
        return 'ROOVIO';
    }
  };

  const availableMonths = [
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12',
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
        {/* Mobile Left / Desktop Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="md:hidden flex items-center">
            <RoovioLogo size="xs" variant="mark-only" className="p-1 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
                {getPageTitle()}
              </h1>
              {properties.length > 1 && (
                <div className="flex items-center">
                  <select
                    value={activePropertyId || state.property.id}
                    onChange={(e) => setActiveBuilding(e.target.value)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[140px] sm:max-w-none truncate"
                    aria-label="Switch active building"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isArchived ? '(Archived)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {properties.length <= 1 && (
              <p className="hidden sm:block text-xs text-slate-500 font-medium truncate">
                {state.property.name}
              </p>
            )}
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Offline indicator if browser is offline */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] sm:text-xs font-medium">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Month Selector for billing context */}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 text-xs">
            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
            <select
              aria-label="Select billing month"
              value={state.selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-[11px] sm:text-xs"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatBillingMonth(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Discreet demo notice on desktop header */}
          <div className="hidden lg:block">
            <DemoNotice />
          </div>

          {/* Primary Quick Action Button */}
          {onOpenOnboard && (
            <button
              type="button"
              onClick={onOpenOnboard}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[34px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tenant</span>
            </button>
          )}

          {/* Settings button */}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Open settings and storage information"
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <SettingsIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Owner Sign Out Button */}
          {user && (
            <button
              type="button"
              onClick={() => logout()}
              title={`Sign out (${user.email})`}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
