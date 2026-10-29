import React, { useState, useEffect } from 'react';
import { useData } from '../persistence/DataContext';
import { useAuth } from '../persistence/AuthContext';
import { formatIndianDate } from '../utils/date';
import { validateImportedJSON } from '../persistence/storage';
import {
  Settings,
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Save,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Cloud,
  HardDrive,
  LogOut,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { state, updateProperty, resetData, exportData, importData } = useData();
  const { user, logout, isSupabaseActive } = useAuth();

  // Property form state
  const [propertyName, setPropertyName] = useState(state.property.name);
  const [address, setAddress] = useState(state.property.address);
  const [city, setCity] = useState(state.property.city);
  const [pincode, setPincode] = useState(state.property.pincode);
  const [phone, setPhone] = useState(state.property.phone);
  const [upiId, setUpiId] = useState(state.property.upiId);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Import / reset feedback
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // PWA Install prompt handling
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleSaveProperty = (e: React.FormEvent) => {
    e.preventDefault();
    updateProperty({
      name: propertyName.trim(),
      address: address.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      phone: phone.trim(),
      upiId: upiId.trim(),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    const confirm = window.confirm(
      'Are you sure you want to reset all data to the default demo state? Any custom tenants, rooms, or transactions created on this device will be erased.'
    );
    if (!confirm) return;
    resetData();
    setImportStatus({ success: true, message: 'All demo fixtures reset to default 29 October 2026 dataset.' });
    setTimeout(() => setImportStatus(null), 4000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!validateImportedJSON(parsed)) {
          setImportStatus({ success: false, message: 'Import failed: The selected JSON file does not match the ROOVIO data schema.' });
          return;
        }

        const res = importData(parsed);
        if (res.success) {
          setImportStatus({ success: true, message: 'Backup successfully restored into browser local storage.' });
        } else {
          setImportStatus({ success: false, message: res.error || 'Failed to import state.' });
        }
      } catch (err) {
        setImportStatus({ success: false, message: 'Import failed: Invalid JSON syntax in file.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Settings & Cloud Integration
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Owner account management, Supabase cloud sync, property identity, and storage backups
        </p>
      </div>

      {/* Active Owner Account & Cloud Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Owner Account Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Authenticated Owner</h3>
                <p className="text-[11px] text-slate-500">Active session & private data partition</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Owner Name:</span>
              <span className="font-semibold text-slate-800">{user?.name || 'PG Owner'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-mono text-slate-800">{user?.email || 'owner@roovio.in'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Owner ID:</span>
              <span className="font-mono text-[11px] text-slate-500">{user?.id || 'owner-gv-default'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PG Property:</span>
              <span className="font-semibold text-brand-700">{state.property.name}</span>
            </div>
          </div>
        </div>

        {/* Supabase Cloud Connection Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  isSupabaseActive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isSupabaseActive ? (
                  <Cloud className="w-4 h-4" />
                ) : (
                  <HardDrive className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Supabase Free Cloud</h3>
                <p className="text-[11px] text-slate-500">Database & Private Document Storage</p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isSupabaseActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {isSupabaseActive ? 'Online Cloud' : 'Local Partition'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {isSupabaseActive
                ? 'Connected to your Supabase project. Owner accounts, PostgreSQL Row Level Security (RLS), and private tenant documents bucket are active.'
                : 'Running on local isolated storage. To connect to your Supabase Free Tier account, add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'}
            </p>
            <div className="pt-1.5 flex items-center gap-2">
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
              >
                <span>Supabase Free Tier (500MB DB + 1GB Storage)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {importStatus && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            importStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {importStatus.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* Production Warning & Storage Notice (Section 2 & 16) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2 text-xs text-amber-950">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Demo Scope & Persistence Notice
        </div>
        <p className="leading-relaxed">
          ROOVIO PG Manager is currently running in <strong>Interactive Demo Mode</strong> with data persisted locally in your browser's <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">localStorage</code>.
        </p>
        <p className="leading-relaxed text-amber-900">
          <strong>Important:</strong> This version is an operational simulation and is <strong>not ready for production tenant records</strong>. Local browser data can be permanently cleared if browser cache/history is wiped or when using incognito mode. Production deployment requires authenticated multi-tenant access, a secure cloud PostgreSQL database, role-based authorization, automated encrypted backups, and legal privacy safeguards.
        </p>
      </div>

      {/* Demo Reference Date Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Demo Reference Date
          </span>
          <span className="text-base font-bold text-slate-900 mt-0.5 block">
            {formatIndianDate(state.demoDate)} ({state.demoDate})
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            Fixed operational reference date ensuring reproducible rent overdue calculations and demo cash flow.
          </p>
        </div>
        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200">
          Fixed Demo Clock
        </span>
      </div>

      {/* PWA Section (Only when supported) */}
      {isInstallable && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-600 text-white rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-900">Install Progressive Web App (PWA)</h3>
              <p className="text-xs text-brand-700 mt-0.5">
                Install ROOVIO on your device home screen for quick offline access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            Install App
          </button>
        </div>
      )}

      {/* Property Details Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Property Information
            </h3>
            <p className="text-xs text-slate-500">
              Appears on receipts, tenant WhatsApp templates, and reports
            </p>
          </div>
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProperty} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Property Name *
            </label>
            <input
              type="text"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                City & State *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                PIN Code *
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Phone *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Primary UPI ID for Rent *
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono font-bold"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Property Information</span>
            </button>
          </div>
        </form>
      </div>

      {/* JSON Backup & Restore & Reset (Section 16) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Backup, Restore & Reset
          </h3>
          <p className="text-xs text-slate-500">
            Export a validated JSON snapshot of your data or restore from a previous backup
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Export JSON */}
          <button
            type="button"
            onClick={exportData}
            className="p-4 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 transition-all text-left flex flex-col justify-between"
          >
            <div>
              <Download className="w-5 h-5 text-brand-600 mb-2" />
              <div className="text-xs font-bold text-slate-900">Export Backup JSON</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Download complete rooms, tenants, payments, and expenses.
              </p>
            </div>
            <span className="text-xs font-semibold text-brand-600 mt-3 inline-block">Download →</span>
          </button>

          {/* Import JSON */}
          <label className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left flex flex-col justify-between cursor-pointer">
            <div>
              <Upload className="w-5 h-5 text-emerald-600 mb-2" />
              <div className="text-xs font-bold text-slate-900">Restore Backup JSON</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Upload and validate a saved ROOVIO JSON backup.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 mt-3 inline-block">Choose File →</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>

          {/* Reset Demo Data */}
          <button
            type="button"
            onClick={handleReset}
            className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 transition-all text-left flex flex-col justify-between"
          >
            <div>
              <RotateCcw className="w-5 h-5 text-rose-600 mb-2" />
              <div className="text-xs font-bold text-rose-950">Reset Demo Data</div>
              <p className="text-[11px] text-rose-700 mt-1">
                Restore the initial 16-tenant, ₹71,100 expense baseline.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-800 mt-3 inline-block">Reset Now →</span>
          </button>
        </div>
      </div>
    </div>
  );
};

