import React, { useState, useMemo } from 'react';
import { useData } from '../persistence/DataContext';
import { Expense, ExpenseCategory } from '../types';
import { formatINR } from '../utils/currency';
import { formatIndianDate, formatBillingMonth } from '../utils/date';
import { downloadCSV } from '../utils/csv';
import { ExpenseModal } from '../components/expenses/ExpenseModal';
import {
  ReceiptIndianRupee,
  Plus,
  Download,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ShieldCheck,
  Edit2,
} from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { state, metrics } = useData();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>(undefined);

  // Month's expenses
  const monthExpenses = useMemo(() => {
    return state.expenses.filter((e) => e.paymentDate.startsWith(state.selectedMonth));
  }, [state.expenses, state.selectedMonth]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'all') return monthExpenses;
    return monthExpenses.filter((e) => e.category === categoryFilter);
  }, [monthExpenses, categoryFilter]);

  // Total expenses for the month
  const totalExpenseAmount = useMemo(() => {
    return monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthExpenses]);

  // Month's rent payments (Inflows)
  const monthPayments = useMemo(() => {
    return state.payments.filter((p) => p.billingMonth === state.selectedMonth);
  }, [state.payments, state.selectedMonth]);

  const totalRentalInflow = useMemo(() => {
    return monthPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [monthPayments]);

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    monthExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });

    return Object.entries(map).map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: totalExpenseAmount > 0 ? Math.round((amount / totalExpenseAmount) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, totalExpenseAmount]);

  // Combined Dated Cash Flow Ledger (Inflows & Outflows)
  const combinedLedger = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      type: 'inflow' | 'outflow';
      title: string;
      category: string;
      amount: number;
      paymentMode: string;
      notes?: string;
    }> = [];

    // Rental inflows
    monthPayments.forEach((p) => {
      const tenant = state.tenants.find((t) => t.id === p.tenantId);
      items.push({
        id: p.id,
        date: p.paymentDate,
        type: 'inflow',
        title: `Rent Collection: ${tenant?.name || 'Tenant'} (${p.receiptNumber})`,
        category: 'Rental Income',
        amount: p.amount,
        paymentMode: p.paymentMethod,
        notes: p.notes,
      });
    });

    // Expense outflows
    monthExpenses.forEach((e) => {
      items.push({
        id: e.id,
        date: e.paymentDate,
        type: 'outflow',
        title: e.title,
        category: e.category,
        amount: e.amount,
        paymentMode: e.paymentMode,
        notes: e.notes,
      });
    });

    // Sort descending by date
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthPayments, monthExpenses, state.tenants]);

  // CSV Export handler (safely escaped)
  const handleExportCSV = () => {
    const headers = [
      'Transaction Date',
      'Flow Type',
      'Title / Description',
      'Category',
      'Amount (INR)',
      'Payment Mode',
      'Notes',
    ];

    const rows = combinedLedger.map((item) => [
      item.date,
      item.type === 'inflow' ? 'Inflow (+)' : 'Outflow (-)',
      item.title,
      item.category,
      item.amount,
      item.paymentMode,
      item.notes || '',
    ]);

    downloadCSV(
      `roovio_cashflow_${state.selectedMonth}.csv`,
      headers,
      rows
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Expenses & Cash Flow
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Operational cash ledger for {formatBillingMonth(state.selectedMonth)} (Deposits strictly segregated)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExpenseToEdit(undefined);
              setShowExpenseModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Log Expense</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Inflow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rental Inflows (Month)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-800 tabular-nums">
            {formatINR(totalRentalInflow)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {monthPayments.length} Rent payment receipts cleared
          </p>
        </div>

        {/* Total Outflow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Operating Outflows
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-800 tabular-nums">
            {formatINR(totalExpenseAmount)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {monthExpenses.length} Operating & maintenance items
          </p>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Cash Flow
            </span>
            <div className={`p-2 rounded-xl ${metrics.netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {metrics.netCashFlow >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${metrics.netCashFlow >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            {formatINR(metrics.netCashFlow, true)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rent received minus expenses paid
          </p>
        </div>
      </div>

      {/* Category Breakdown Progress Bars (Section 14) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Expense Breakdown by Category ({formatBillingMonth(state.selectedMonth)})
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Total: {formatINR(totalExpenseAmount)}
          </span>
        </div>

        <div className="space-y-3">
          {categoryBreakdown.map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700 font-bold">{item.category}</span>
                <span className="text-slate-900 tabular-nums font-semibold">
                  {formatINR(item.amount)} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Combined Dated Cash Flow Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Combined Dated Cash-Flow Ledger</h3>
            <p className="text-xs text-slate-500">
              Chronological order of all verified monthly inflows & outflows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Electricity">Electricity</option>
              <option value="Water">Water</option>
              <option value="Mess / groceries">Mess / groceries</option>
              <option value="Staff salary">Staff salary</option>
              <option value="Internet">Internet</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Property rent / EMI">Property rent / EMI</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View (>=768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction / Payee</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Inflow (+)</th>
                <th className="py-3 px-4 text-right">Outflow (-)</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {combinedLedger
                .filter((item) => categoryFilter === 'all' || item.category === categoryFilter || item.type === 'inflow')
                .map((item) => {
                  const isInflow = item.type === 'inflow';
                  const rawExpense = !isInflow ? state.expenses.find((e) => e.id === item.id) : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                        {formatIndianDate(item.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{item.title}</div>
                        {item.notes && <div className="text-[10px] text-slate-400 font-normal">{item.notes}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{item.paymentMode}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800 tabular-nums">
                        {isInflow ? formatINR(item.amount) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-800 tabular-nums">
                        {!isInflow ? formatINR(item.amount) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isInflow && rawExpense && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpenseToEdit(rawExpense);
                              setShowExpenseModal(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Mobile Ledger Cards (<768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {combinedLedger
            .filter((item) => categoryFilter === 'all' || item.category === categoryFilter || item.type === 'inflow')
            .map((item) => {
              const isInflow = item.type === 'inflow';
              const rawExpense = !isInflow ? state.expenses.find((e) => e.id === item.id) : null;

              return (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{formatIndianDate(item.date)}</span>
                      <span>•</span>
                      <span className="capitalize">{item.paymentMode}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div className={`text-xs font-bold tabular-nums ${isInflow ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {isInflow ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`}
                      </div>
                      <span className="text-[9px] uppercase font-bold text-slate-400">
                        {isInflow ? 'Inflow' : 'Outflow'}
                      </span>
                    </div>
                    {rawExpense && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpenseToEdit(rawExpense);
                          setShowExpenseModal(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Edit expense"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Security Deposit Segregation Notice (Section 14) */}
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed">
          <strong className="text-slate-900">Accounting Standard Compliance:</strong> Security deposits collected from tenants (Total holding: {formatINR(state.securityDeposits.filter((d) => d.type === 'collected').reduce((sum, d) => sum + d.amount, 0))}) are refundable liabilities and are strictly excluded from rental revenue and monthly net cash flow calculations.
        </div>
      </div>

      {/* Modals */}
      {showExpenseModal && (
        <ExpenseModal
          isOpen={true}
          onClose={() => {
            setShowExpenseModal(false);
            setExpenseToEdit(undefined);
          }}
          expenseToEdit={expenseToEdit}
        />
      )}
    </div>
  );
};

