import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './persistence/AuthContext';
import { DataProvider } from './persistence/DataContext';
import { Sidebar } from './components/shell/Sidebar';
import { Header } from './components/shell/Header';
import { MobileBottomNav } from './components/shell/MobileBottomNav';
import { ProductionWarningBanner } from './components/common/DemoNotice';
import { OnboardingModal } from './components/tenants/OnboardingModal';
import { PaymentModal } from './components/tenants/PaymentModal';
import { RoovioLogo } from './components/common/RoovioLogo';

// Code-split pages for high performance & minimal initial bundle
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const BuildingPage = lazy(() => import('./pages/BuildingPage').then((m) => ({ default: m.BuildingPage })));
const TenantsPage = lazy(() => import('./pages/TenantsPage').then((m) => ({ default: m.TenantsPage })));
const TenantDetailPage = lazy(() => import('./pages/TenantDetailPage').then((m) => ({ default: m.TenantDetailPage })));
const FacilitiesPage = lazy(() => import('./pages/FacilitiesPage').then((m) => ({ default: m.FacilitiesPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PageFallback: React.FC = () => (
  <div className="py-20 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <RoovioLogo size="sm" variant="mark-only" className="animate-pulse p-2 rounded-xl bg-white border border-slate-200 shadow-xs" />
      <p className="text-xs text-slate-400 font-medium tracking-wide">Loading view...</p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [globalOnboardOpen, setGlobalOnboardOpen] = useState(false);
  const [globalPaymentOpen, setGlobalPaymentOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RoovioLogo size="md" variant="mark-only" className="animate-pulse p-2 rounded-xl bg-white border border-slate-200 shadow-xs" />
          <p className="text-xs text-slate-500 font-semibold tracking-wide">Loading ROOVIO PG Manager...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageFallback />}>
        <AuthPage />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Top Production Warning Banner */}
      <div className="no-print">
        <ProductionWarningBanner />
      </div>

      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (hidden below 768px) */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onOpenOnboard={() => setGlobalOnboardOpen(true)}
            onOpenRecordPayment={() => setGlobalPaymentOpen(true)}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 pb-24 md:pb-8">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/building" element={<BuildingPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
                <Route path="/facilities" element={<FacilitiesPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>

      {/* Mobile Sticky 5-Tab Bottom Navigation (visible below 768px) */}
      <div className="no-print">
        <MobileBottomNav />
      </div>

      {/* Global Quick Action Modals */}
      {globalOnboardOpen && (
        <OnboardingModal
          isOpen={true}
          onClose={() => setGlobalOnboardOpen(false)}
        />
      )}

      {globalPaymentOpen && (
        <PaymentModal
          isOpen={true}
          onClose={() => setGlobalPaymentOpen(false)}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
