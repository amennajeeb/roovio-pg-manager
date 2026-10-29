import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../persistence/DataContext';
import { formatINR } from '../utils/currency';
import { formatIndianDate, formatBillingMonth } from '../utils/date';
import { StatCard } from '../components/common/StatCard';
import { OnboardingModal } from '../components/tenants/OnboardingModal';
import { PaymentModal } from '../components/tenants/PaymentModal';
import { ExpenseModal } from '../components/expenses/ExpenseModal';
import { RoomModal } from '../components/building/RoomModal';
import { TenantDrawer } from '../components/tenants/TenantDrawer';
import { FloorBedMatrixOverview } from '../components/dashboard/FloorBedMatrixOverview';
import {
  Bed,
  CreditCard,
  ReceiptIndianRupee,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Wrench,
  UserPlus,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { state, metrics, generateMonthlyCharges } = useData();
  const navigate = useNavigate();

  // Modals state
  const [showOnboard, setShowOnboard] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  // Generate monthly charges handler
  const handleGenerateCharges = () => {
    const res = generateMonthlyCharges(state.selectedMonth);
    if (res.generatedCount > 0) {
      setGenMessage(`Generated ${res.generatedCount} rent charge(s) for ${formatBillingMonth(state.selectedMonth)}.`);
    } else {
      setGenMessage(`All active tenants already have charges for ${formatBillingMonth(state.selectedMonth)} (${res.alreadyExistedCount} charges exist).`);
    }
    setTimeout(() => setGenMessage(null), 4000);
  };

  // Urgent Rent follow-up list (overdue or due soon)
  const monthCharges = state.rentCharges.filter((c) => c.billingMonth === state.selectedMonth);
  const followUpTenants = state.tenants
    .map((tenant) => {
      const charge = monthCharges.find((c) => c.tenantId === tenant.id);
      if (!charge) return null;

      const paid = state.payments
        .filter((p) => p.chargeId === charge.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const balance = charge.amount - paid;
      if (balance <= 0) return null;

      const isOverdue = state.demoDate > charge.dueDate;
      const room = state.rooms.find((r) => r.id === tenant.roomId);
      const bed = room?.beds.find((b) => b.id === tenant.bedId);

      return {
        tenant,
        charge,
        room,
        bed,
        paid,
        balance,
        isOverdue,
      };
    })
    .filter(Boolean) as {
      tenant: typeof state.tenants[0];
      charge: typeof state.rentCharges[0];
      room: typeof state.rooms[0] | undefined;
      bed: typeof state.rooms[0]['beds'][0] | undefined;
      paid: number;
      balance: number;
      isOverdue: boolean;
    }[];

  // Sort: overdue first, then by balance
  followUpTenants.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.balance - a.balance;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Property Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {formatBillingMonth(state.selectedMonth)} Operations • Ref Date: {formatIndianDate(state.demoDate)}
          </p>
        </div>

        {/* Quick Actions Grid / Buttons */}
        <div className="grid grid-cols-3 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOnboard(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors min-h-[38px]"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Add Tenant</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPayment(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors min-h-[38px]"
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Payment</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExpense(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors min-h-[38px]"
          >
            <ReceiptIndianRupee className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Expense</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddRoom(true)}
            className="hidden lg:flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors min-h-[38px]"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {genMessage && (
        <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
          <span>{genMessage}</span>
        </div>
      )}

      {/* 4 Computed Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Occupancy */}
        <StatCard
          label="Bed Occupancy"
          value={`${metrics.occupancyRate}%`}
          subValue={`${metrics.occupiedBeds} occ • ${metrics.vacantBeds} vac`}
          subValueColor="slate"
          icon={Bed}
          iconBg="bg-blue-50"
          iconColor="text-brand-600"
          progress={{
            current: metrics.occupiedBeds,
            total: metrics.totalBeds,
            percent: metrics.occupancyRate,
            barColor: 'bg-brand-600',
          }}
          actionText="View vacant"
          onAction={() => navigate('/building?filter=vacant')}
        />

        {/* Card 2: Rent Collection */}
        <StatCard
          label="Rent Collected"
          value={formatINR(metrics.collectedRent)}
          subValue={`Bal: ${formatINR(metrics.remainingBalance)}`}
          subValueColor={metrics.remainingBalance > 0 ? 'amber' : 'emerald'}
          icon={CreditCard}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
          actionText="View dues"
          onAction={() => navigate('/tenants')}
        />

        {/* Card 3: Monthly Expenses */}
        <StatCard
          label="Expenses"
          value={formatINR(metrics.monthlyExpenses)}
          subValue="Mess, staff, repairs"
          subValueColor="slate"
          icon={ReceiptIndianRupee}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
          actionText="Breakdown"
          onAction={() => navigate('/expenses')}
        />

        {/* Card 4: Net Cash Flow */}
        <StatCard
          label="Net Cash Flow"
          value={formatINR(metrics.netCashFlow, true)}
          subValue="Inflows vs Outflows"
          subValueColor={metrics.netCashFlow >= 0 ? 'emerald' : 'rose'}
          icon={metrics.netCashFlow >= 0 ? TrendingUp : TrendingDown}
          iconBg={metrics.netCashFlow >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}
          iconColor={metrics.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}
          actionText="View ledger"
          onAction={() => navigate('/expenses')}
        />
      </div>

      {/* Attention Panel & Matrix Preview Side-by-Side on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Attention Panel (1 col) */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Requires Attention</span>
            </h3>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {/* Attention 1: Overdue Rent */}
            <div
              onClick={() => navigate('/tenants?filter=overdue')}
              className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 sm:p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-rose-900 truncate">
                    {metrics.overdueCount} Overdue Tenant{metrics.overdueCount === 1 ? '' : 's'}
                  </h4>
                  <p className="text-[11px] text-rose-700 mt-0.5 truncate">
                    Balance: <strong className="tabular-nums font-bold">{formatINR(metrics.overdueAmount)}</strong>
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-rose-400 shrink-0 ml-1" />
            </div>

            {/* Attention 2: Notice Period */}
            <div
              onClick={() => navigate('/tenants?filter=notice')}
              className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 sm:p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                  <Bed className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-amber-900 truncate">
                    {metrics.noticeCount} on Notice
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5 truncate">
                    Move-outs scheduled soon
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 ml-1" />
            </div>

            {/* Attention 3: Open Maintenance Tickets */}
            <div
              onClick={() => navigate('/facilities')}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 sm:p-2 bg-slate-200 text-slate-700 rounded-lg shrink-0 mt-0.5">
                  <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {metrics.openTicketsCount} Open Ticket{metrics.openTicketsCount === 1 ? '' : 's'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Repairs in progress
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </div>
          </div>

          {/* Quick billing generation tool */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 truncate">
              Month: <strong>{formatBillingMonth(state.selectedMonth)}</strong>
            </span>
            <button
              type="button"
              onClick={handleGenerateCharges}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline shrink-0"
            >
              Generate Rent Charges →
            </button>
          </div>
        </div>

        {/* Right: Rent Follow-up List & Room Preview (2 cols) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Rent Follow-up List */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider truncate">
                  Rent Follow-Up ({formatBillingMonth(state.selectedMonth)})
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  Tenants with overdue or pending monthly balance
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tenants')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline shrink-0"
              >
                View all ({state.tenants.length}) →
              </button>
            </div>

            {followUpTenants.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                All tenants have cleared rent for {formatBillingMonth(state.selectedMonth)}!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {followUpTenants.slice(0, 5).map(({ tenant, charge, room, bed, balance, isOverdue }) => (
                  <div
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 -mx-1.5 px-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {tenant.name}
                        </span>
                        {isOverdue ? (
                          <span className="text-[9px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded-full border border-rose-200 shrink-0">
                            Overdue
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200 shrink-0">
                            Due
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                        <span>R-{room?.roomNumber || '—'} / {bed?.label || '—'}</span>
                        <span>•</span>
                        <span>Due {formatIndianDate(charge.dueDate)}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatINR(balance)}
                      </span>
                      <div className="text-[10px] text-brand-600 font-semibold hover:underline">
                        Details →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Floor & Bed Matrix Overview (Spans 2 columns on desktop) */}
          <FloorBedMatrixOverview
            rooms={state.rooms}
            floors={state.floors}
            tenants={state.tenants}
            className="lg:col-span-2"
          />
        </div>
      </div>

      {/* Modals */}
      {showOnboard && (
        <OnboardingModal
          isOpen={true}
          onClose={() => setShowOnboard(false)}
          onSuccess={(id) => setSelectedTenantId(id)}
        />
      )}

      {showPayment && (
        <PaymentModal
          isOpen={true}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showExpense && (
        <ExpenseModal
          isOpen={true}
          onClose={() => setShowExpense(false)}
        />
      )}

      {showAddRoom && (
        <RoomModal
          isOpen={true}
          onClose={() => setShowAddRoom(false)}
        />
      )}

      {selectedTenantId && (
        <TenantDrawer
          isOpen={true}
          onClose={() => setSelectedTenantId(null)}
          tenantId={selectedTenantId}
        />
      )}
    </div>
  );
};
