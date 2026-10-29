import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldAlert,
  CloudCheck,
  RefreshCw,
  AlertTriangle,
  CloudOff,
  ChevronDown,
  ChevronUp,
  X,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../../persistence/DataContext';

export const DemoNotice: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { storageMode, cloudSyncStatus, syncWithCloud } = useData();

  if (storageMode === 'cloud') {
    if (cloudSyncStatus === 'synced') {
      return (
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg ${className}`}
          title="Authenticated Cloud Mode: Live multi-tenant isolation active with Supabase PostgreSQL."
        >
          <CloudCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Cloud Connected</span>
        </div>
      );
    }

    if (cloudSyncStatus === 'syncing') {
      return (
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded-lg ${className}`}
          title="Synchronizing records with Supabase cloud database..."
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
          <span className="truncate">Syncing Cloud...</span>
        </div>
      );
    }

    if (cloudSyncStatus === 'offline_cache') {
      return (
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 ${className}`}
          title="Working from local offline cache. Click to retry syncing with Supabase."
          role="button"
          tabIndex={0}
          onClick={() => syncWithCloud()}
          onKeyDown={(e) => e.key === 'Enter' && syncWithCloud()}
        >
          <CloudOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="truncate">Offline Cache • Sync</span>
        </div>
      );
    }

    if (cloudSyncStatus === 'error') {
      return (
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-lg cursor-pointer hover:bg-rose-100 ${className}`}
          title="Failed to communicate with Supabase. Click to retry."
          role="button"
          tabIndex={0}
          onClick={() => syncWithCloud()}
          onKeyDown={(e) => e.key === 'Enter' && syncWithCloud()}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="truncate">Cloud Error • Retry</span>
        </div>
      );
    }
  }

  // Fallback for Demo Mode
  return (
    <div
      className={`demo-indicator inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg ${className}`}
      title="This is an interactive browser demo. Data is stored strictly on this device's browser storage."
    >
      <Database className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span className="truncate">Demo data • Local Storage</span>
      <Link
        to="/settings"
        className="ml-1 text-brand-600 hover:text-brand-700 underline font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        Info
      </Link>
    </div>
  );
};

export const ProductionWarningBanner: React.FC = () => {
  const { storageMode, cloudSyncStatus, cloudError, syncWithCloud } = useData();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('roovio_demo_banner_dismissed') === 'true';
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('roovio_demo_banner_dismissed', 'true');
  };

  // If in cloud mode and fully synced, do not show warning banner
  if (storageMode === 'cloud' && cloudSyncStatus === 'synced') {
    return null;
  }

  if (storageMode === 'cloud' && cloudSyncStatus === 'syncing') {
    return (
      <div className="bg-sky-50 border-b border-sky-200 px-3 sm:px-4 py-1.5 text-xs text-sky-900">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
          <span className="truncate">
            <strong>Cloud Sync in Progress:</strong> Synchronizing PG records with Supabase cloud database...
          </span>
        </div>
      </div>
    );
  }

  if (storageMode === 'cloud' && cloudSyncStatus === 'offline_cache') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-2 text-xs text-amber-900">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">
              <strong>Offline Cache Active:</strong> Working with cached records.
            </span>
          </div>
          <button
            type="button"
            onClick={() => syncWithCloud()}
            className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shrink-0"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  if (storageMode === 'cloud' && cloudSyncStatus === 'error') {
    return (
      <div className="bg-rose-50 border-b border-rose-200 px-3 sm:px-4 py-2 text-xs text-rose-900">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="truncate">
              <strong>Cloud Error:</strong> {cloudError || 'Unable to connect to Supabase database.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => syncWithCloud()}
            className="px-2.5 py-1 text-xs font-semibold text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition-colors shrink-0"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // If dismissed during this session, render a sleek hairline bar or null
  if (isDismissed) {
    return null;
  }

  // Interactive Demo Mode Compact Banner
  return (
    <div className="bg-amber-50/95 border-b border-amber-200 text-xs text-amber-950 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] sm:text-xs truncate">
            <strong>Interactive Demo Mode:</strong> Data is saved locally in browser storage.
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline shrink-0"
          >
            {isExpanded ? (
              <>Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Details <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="sm:hidden text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300"
          >
            {isExpanded ? 'Hide' : 'Info'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss notice for this session"
            className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 sm:px-6 py-2 bg-amber-100/60 border-t border-amber-200/60 text-[11px] text-amber-900 leading-relaxed max-w-7xl mx-auto">
          <p>
            This demo simulates full property operations on your device. For actual production deployments with multiple wardens/managers, connect to Supabase in <strong>Settings</strong> to activate PostgreSQL cloud storage, row-level isolation, and encrypted backups.
          </p>
        </div>
      )}
    </div>
  );
};
