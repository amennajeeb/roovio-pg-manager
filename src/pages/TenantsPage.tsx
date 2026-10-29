import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '../persistence/DataContext';
import { formatINR } from '../utils/currency';
import { formatIndianDate, formatBillingMonth } from '../utils/date';
import { downloadCSV } from '../utils/csv';
import { BedStatusBadge, RentStatusBadge } from '../components/common/Badge';
import { TenantDrawer } from '../components/tenants/TenantDrawer';
import { OnboardingModal } from '../components/tenants/OnboardingModal';
import { PaymentModal } from '../components/tenants/PaymentModal';
import { WhatsAppPreviewModal } from '../components/tenants/WhatsAppPreviewModal';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  CreditCard,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Download,
  Briefcase,
  Layers,
} from 'lucide-react';

export const TenantsPage: React.FC = () => {
  const { state } = useData();
  const [searchParams] = useSearchParams();

  const initialFilter = searchParams.get('filter') || 'active';
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [quickPaymentTenantId, setQuickPaymentTenantId] = useState<string | null>(null);
  const [quickWhatsAppTenantId, setQuickWhatsAppTenantId] = useState<string | null>(null);

  // Charges for selectedMonth
  const monthCharges = state.rentCharges.filter((c) => c.billingMonth === state.selectedMonth);

  // Augmented tenants with dynamic financial metrics for current month
  const augmentedTenants = useMemo(() => {
    return state.tenants.map((tenant) => {
      const room = state.rooms.find((r) => r.id === tenant.roomId);
      const bed = room?.beds.find((b) => b.id === tenant.bedId);

      const charge = monthCharges.find((c) => c.tenantId === tenant.id);
      const paid = charge
        ? state.payments
            .filter((p) => p.chargeId === charge.id)
            .reduce((sum, p) => sum + p.amount, 0)
        : 0;

      const balance = charge ? Math.max(0, charge.amount - paid) : 0;
      const isOverdue = charge ? state.demoDate > charge.dueDate && balance > 0 : false;
      const isDueSoon = charge ? state.demoDate <= charge.dueDate && balance > 0 : false;
      const isPaid = charge ? balance <= 0 : false;

      let rentStatus: 'paid' | 'overdue' | 'due_soon' | 'partially_paid' = 'due_soon';
      if (isPaid) {
        rentStatus = 'paid';
      } else if (isOverdue) {
        rentStatus = 'overdue';
      } else if (paid > 0) {
        rentStatus = 'partially_paid';
      }

      return {
        tenant,
        room,
        bed,
        charge,
        paid,
        balance,
        isOverdue,
        isDueSoon,
        isPaid,
        rentStatus,
      };
    });
  }, [state.tenants, state.rooms, monthCharges, state.payments, state.demoDate]);

  // Filter & Search: supports search by tenant name, phone number, company, room and berth
  const filteredList = useMemo(() => {
    return augmentedTenants.filter((item) => {
      const t = item.tenant;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesPhone =
          t.phone.toLowerCase().includes(q) ||
          Boolean(t.alternatePhone && t.alternatePhone.toLowerCase().includes(q));
        const matchesCompany = Boolean(t.employerName && t.employerName.toLowerCase().includes(q));
        const matchesRoom = Boolean(item.room?.roomNumber.toLowerCase().includes(q));
        const matchesBed = Boolean(
          (item.bed?.label && item.bed.label.toLowerCase().includes(q)) ||
          (item.bed?.id && item.bed.id.toLowerCase().includes(q)) ||
          (item.bed?.bunkGroup && item.bed.bunkGroup.toLowerCase().includes(q)) ||
          (item.bed?.tier && item.bed.tier.toLowerCase().includes(q))
        );
        if (!matchesName && !matchesPhone && !matchesCompany && !matchesRoom && !matchesBed) {
          return false;
        }
      }

      // Status filters
      if (activeFilter === 'active') return t.status === 'active' || t.status === 'notice';
      if (activeFilter === 'overdue') return item.isOverdue && (t.status === 'active' || t.status === 'notice');
      if (activeFilter === 'due_soon') return item.isDueSoon && (t.status === 'active' || t.status === 'notice');
      if (activeFilter === 'paid') return item.isPaid && (t.status === 'active' || t.status === 'notice');
      if (activeFilter === 'notice') return t.status === 'notice';
      if (activeFilter === 'former') return t.status === 'checked_out';

      return true;
    });
  }, [augmentedTenants, activeFilter, searchQuery]);

  // Target tenant for quick WhatsApp
  const quickWhatsAppItem = augmentedTenants.find((item) => item.tenant.id === quickWhatsAppTenantId);

  // Safe Tenant Directory CSV Export (strictly excludes private documents and identity numbers)
  const exportTenantsCSV = () => {
    const headers = [
      'Tenant Name',
      'Status',
      'Primary Phone',
      'Alternate Phone',
      'Email',
      'Employer / Company',
      'Job Title',
      'Room Number',
      'Berth Label',
      'Berth ID',
      'Joining Date',
      'Agreed Rent (INR)',
      'Due Day',
      'Deposit Received (INR)',
      'Outstanding Balance (INR)',
    ];

    const rows = filteredList.map(({ tenant, room, bed, balance }) => [
      tenant.name,
      tenant.status,
      tenant.phone,
      tenant.alternatePhone || '',
      tenant.email || '',
      tenant.employerName || '',
      tenant.jobTitle || '',
      room?.roomNumber || '',
      bed?.label || '',
      bed?.id || '',
      tenant.joiningDate,
      tenant.monthlyRent,
      tenant.monthlyDueDay,
      tenant.depositReceived,
      balance,
    ]);

    downloadCSV(`tenants_directory_${state.demoDate}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Tenants & Rent Dues
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Billing month: {formatBillingMonth(state.selectedMonth)} • Ref date: {formatIndianDate(state.demoDate)}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={exportTenantsCSV}
            title="Export Safe Tenant CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Tenant</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'active', label: `Active (${state.tenants.filter((t) => t.status !== 'checked_out').length})` },
            { id: 'overdue', label: 'Overdue' },
            { id: 'due_soon', label: 'Due Soon' },
            { id: 'paid', label: 'Paid' },
            { id: 'notice', label: 'Notice Period' },
            { id: 'former', label: 'Former / History' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                activeFilter === tab.id
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, phone, company, room, berth..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No tenants found</h3>
          <p className="text-xs text-slate-400 mt-1">Try clearing your search query or changing filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (>=768px) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Tenant Name</th>
                  <th className="py-3.5 px-4">Room & Berth</th>
                  <th className="py-3.5 px-4">Employer</th>
                  <th className="py-3.5 px-4 text-right">Monthly Rent</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Deposit</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map(({ tenant, room, bed, charge, balance, rentStatus, isOverdue }) => (
                  <tr
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-brand-600">
                      <div className="truncate max-w-[160px]">{tenant.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal font-mono">{tenant.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      <div>Room {room?.roomNumber || '—'} • {bed?.label || '—'}</div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {bed?.bedType === 'bunk' ? `${bed.tier} berth` : 'single bed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {tenant.employerName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 font-medium">
                          <Briefcase className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[120px]">{tenant.employerName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums text-right">
                      <div>{formatINR(tenant.monthlyRent)}</div>
                      {tenant.agreedFoodCharge ? (
                        <div className="text-[10px] text-slate-500 font-normal">
                          +{formatINR(tenant.agreedFoodCharge)} food
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {charge ? formatIndianDate(charge.dueDate) : `${tenant.monthlyDueDay}th`}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700 text-right">
                      {formatINR(tenant.depositReceived)}
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums text-right">
                      <span className={balance > 0 ? (isOverdue ? 'text-rose-700' : 'text-amber-700') : 'text-emerald-700'}>
                        {formatINR(balance)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <RentStatusBadge status={rentStatus} balanceRemaining={balance} />
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/tenants/${tenant.id}`}
                          title="Open Full Profile & Documents"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        {balance > 0 && tenant.status !== 'checked_out' && (
                          <button
                            type="button"
                            onClick={() => setQuickPaymentTenantId(tenant.id)}
                            title="Record Payment"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQuickWhatsAppTenantId(tenant.id)}
                          title="WhatsApp Reminder"
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (<768px) */}
          <div className="md:hidden space-y-3">
            {filteredList.map(({ tenant, room, bed, charge, balance, rentStatus, isOverdue }) => (
              <div
                key={tenant.id}
                onClick={() => setSelectedTenantId(tenant.id)}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 cursor-pointer active:bg-slate-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{tenant.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Room {room?.roomNumber}, {bed?.label} {bed?.bedType === 'bunk' ? `(${bed.tier})` : ''}
                    </p>
                    {tenant.employerName && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {tenant.employerName}
                      </span>
                    )}
                  </div>
                  <RentStatusBadge status={rentStatus} balanceRemaining={balance} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Monthly Rent</span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {formatINR(tenant.monthlyRent)}
                      {tenant.agreedFoodCharge ? ` + ${formatINR(tenant.agreedFoodCharge)} food` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Due Date</span>
                    <span className="font-medium text-slate-800">{charge ? formatIndianDate(charge.dueDate) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Deposit Balance</span>
                    <span className="font-semibold text-emerald-800 tabular-nums">{formatINR(tenant.depositReceived)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Outstanding</span>
                    <span className={`font-bold tabular-nums ${balance > 0 ? (isOverdue ? 'text-rose-700' : 'text-amber-700') : 'text-emerald-700'}`}>
                      {formatINR(balance)}
                    </span>
                  </div>
                </div>

                {/* Quick card action buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] text-slate-400 font-mono">{tenant.phone}</span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/tenants/${tenant.id}`}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setQuickWhatsAppTenantId(tenant.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WA</span>
                    </button>
                    {balance > 0 && tenant.status !== 'checked_out' && (
                      <button
                        type="button"
                        onClick={() => setQuickPaymentTenantId(tenant.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-brand-600 rounded-lg flex items-center gap-1 shadow-2xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals & Drawers */}
      {selectedTenantId && (
        <TenantDrawer
          isOpen={true}
          onClose={() => setSelectedTenantId(null)}
          tenantId={selectedTenantId}
        />
      )}

      {showOnboardModal && (
        <OnboardingModal
          isOpen={true}
          onClose={() => setShowOnboardModal(false)}
          onSuccess={(id) => setSelectedTenantId(id)}
        />
      )}

      {quickPaymentTenantId && (
        <PaymentModal
          isOpen={true}
          onClose={() => setQuickPaymentTenantId(null)}
          preselectedTenantId={quickPaymentTenantId}
        />
      )}

      {quickWhatsAppItem && (
        <WhatsAppPreviewModal
          isOpen={true}
          onClose={() => setQuickWhatsAppTenantId(null)}
          tenant={quickWhatsAppItem.tenant}
          charge={quickWhatsAppItem.charge}
          room={quickWhatsAppItem.room}
          bed={quickWhatsAppItem.bed}
          outstandingAmount={quickWhatsAppItem.balance}
        />
      )}
    </div>
  );
};

