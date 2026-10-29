import React, { useState } from 'react';
import { useAuth, BUILT_IN_DEMO_ACCOUNTS } from '../persistence/AuthContext';
import { RoovioLogo } from '../components/common/RoovioLogo';
import {
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Cloud,
  HardDrive,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register, loginAsDemo, isSupabaseActive } = useAuth();

  const [tab, setTab] = useState<'signin' | 'register' | 'demo'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regPropertyName, setRegPropertyName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(signInEmail, signInPassword);
    setLoading(false);

    if (res.success) {
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || 'Failed to sign in. Please verify your credentials.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await register(regEmail, regPassword, regPropertyName, regName);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('Account created successfully! Welcome to your PG dashboard.');
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || 'Registration failed. Please try again.');
    }
  };

  const handleDemoSelect = (type: 'default' | 'alpha' | 'beta') => {
    loginAsDemo(type);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center items-center mb-4">
          <RoovioLogo size="xl" />
        </div>

        <h2 className="text-center text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Owner Portal & Operations Login
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          {isSupabaseActive
            ? 'Connected to Supabase Online Cloud • Secure Owner Isolation'
            : 'Multi-Owner Storage • Isolated PG Accounts & Berths'}
        </p>

        {/* Cloud Status Pill */}
        <div className="mt-3 flex justify-center">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
              isSupabaseActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {isSupabaseActive ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supabase Cloud Active</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                <span>Secure Local Storage Mode (Cloud Ready)</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-6 px-4 shadow-sm border border-slate-200 rounded-2xl sm:px-8">
          {/* Tab Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                tab === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                tab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('demo');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                tab === 'demo'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Demo</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: SIGN IN */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Owner Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="owner@yourpg.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In to Dashboard'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setTab('demo')}
                  className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                >
                  Want to explore with demo data? Click here
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CREATE ACCOUNT */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PG Owner Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PG / Hostel Property Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regPropertyName}
                    onChange={(e) => setRegPropertyName(e.target.value)}
                    placeholder="e.g. Sri Sai Luxury PG for Gents"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="owner@srisaipg.in"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Dashboard...' : 'Create Account & Initialize PG'}
              </button>
            </form>
          )}

          {/* TAB 3: DEMO ACCOUNTS */}
          {tab === 'demo' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-2">
                Select an isolated demo account to test separate owner data, bunk-bed berths, and rent management:
              </p>

              {/* Demo Account 1 */}
              <button
                type="button"
                onClick={() => handleDemoSelect('default')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/30 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-brand-600" />
                    <span>ROOVIO Malabar Residency (Kozhikode Flagship)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mavoor Road, Kozhikode • 16 Tenants • 22 Berths • ₹1,04,000 Expected Rent
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {BUILT_IN_DEMO_ACCOUNTS.default.user.email} (P. K. Narayanan)
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Demo Account 2 */}
              <button
                type="button"
                onClick={() => handleDemoSelect('alpha')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Thavakkara Comfort PG (Kannur District)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Near Railway Station, Thavakkara, Kannur • Isolated PG
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {BUILT_IN_DEMO_ACCOUNTS.alpha.user.email} (Abdul Rasheed K)
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Demo Account 3 */}
              <button
                type="button"
                onClick={() => handleDemoSelect('beta')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/30 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>Nadakkavu Urban Stay (Kozhikode District)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Nadakkavu, Kozhikode • Independent Ledger & Bunks
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {BUILT_IN_DEMO_ACCOUNTS.beta.user.email} (Mathew Varghese)
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          )}

          {/* Privacy Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-normal flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Strict multi-tenant isolation. Passwords and identity documents are never shared across owners or stored in public folders.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

