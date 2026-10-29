import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { PaymentMethod, Tenant, RentCharge } from '../../types';
import { formatINR } from '../../utils/currency';
import { formatBillingMonth } from '../../utils/date';
import { ReceiptModal } from './ReceiptModal';
import { AlertCircle, IndianRupee } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedTenantId?: string;
  preselectedChargeId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  preselectedTenantId,
  preselectedChargeId,
}) => {
  const { state, recordPayment } = useData();

  const [tenantId, setTenantId] = useState(preselectedTenantId || '');
  const [chargeId, setChargeId] = useState(preselectedChargeId || '');
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(state.demoDate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Newly created payment for receipt display
  const [createdPayment, setCreatedPayment] = useState<any | null>(null);

  useEffect(() => {
    if (preselectedTenantId) setTenantId(preselectedTenantId);
    if (preselectedChargeId) setChargeId(preselectedChargeId);
  }, [preselectedTenantId, preselectedChargeId]);

  // Active tenants
  const activeTenants = state.tenants.filter((t) => t.status === 'active' || t.status === 'notice');

  // Charges for selected tenant that have outstanding balance
  const tenantCharges = state.rentCharges.filter((c) => {
    if (!tenantId) return false;
    if (c.tenantId !== tenantId) return false;
    return true;
  });

  // Automatically select the charge if tenant is picked and charge is not set
  useEffect(() => {
    if (tenantId && !chargeId && tenantCharges.length > 0) {
      // Find charge with balance > 0
      const openCharge = tenantCharges.find((c) => {
        const paid = state.payments
          .filter((p) => p.chargeId === c.id)
          .reduce((sum, p) => sum + p.amount, 0);
        return c.amount - paid > 0;
      });
      if (openCharge) {
        setChargeId(openCharge.id);
      } else {
        setChargeId(tenantCharges[0].id);
      }
    }
  }, [tenantId, chargeId, tenantCharges, state.payments]);

  const selectedCharge = state.rentCharges.find((c) => c.id === chargeId);
  const selectedTenant = state.tenants.find((t) => t.id === tenantId);

  // Compute remaining balance for current charge
  const alreadyPaid = selectedCharge
    ? state.payments
        .filter((p) => p.chargeId === selectedCharge.id)
        .reduce((sum, p) => sum + p.amount, 0)
    : 0;
  const balanceRemaining = selectedCharge ? Math.max(0, selectedCharge.amount - alreadyPaid) : 0;

  // Set default amount to remaining balance when charge changes
  useEffect(() => {
    if (balanceRemaining > 0) {
      setAmount(balanceRemaining);
    }
  }, [chargeId, balanceRemaining]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tenantId) {
      setError('Please select a tenant.');
      return;
    }
    if (!chargeId) {
      setError('Please select a rent charge to allocate payment.');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than ₹0.');
      return;
    }
    if (amount > balanceRemaining) {
      setError(
        `Payment amount of ${formatINR(amount)} exceeds the remaining balance of ${formatINR(balanceRemaining)} for this charge.`
      );
      return;
    }

    setIsSubmitting(true);
    const result = recordPayment({
      tenantId,
      chargeId,
      amount,
      paymentDate,
      paymentMethod,
      transactionRef,
      notes,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Failed to record payment.');
    } else {
      // Set for receipt preview
      setCreatedPayment(result.payment);
    }
  };

  const handleCloseAll = () => {
    setCreatedPayment(null);
    onClose();
  };

  if (createdPayment && selectedTenant && selectedCharge) {
    const finalRemaining = balanceRemaining - createdPayment.amount;
    return (
      <ReceiptModal
        isOpen={true}
        onClose={handleCloseAll}
        payment={createdPayment}
        tenant={selectedTenant}
        property={state.property}
        charge={selectedCharge}
        remainingBalance={Math.max(0, finalRemaining)}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Rent Payment"
      description="Allocate payment to tenant monthly rent charge"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tenant selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Tenant *
          </label>
          <select
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setChargeId('');
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          >
            <option value="">-- Select Tenant --</option>
            {activeTenants.map((t) => {
              const room = state.rooms.find((r) => r.id === t.roomId);
              const bed = room?.beds.find((b) => b.id === t.bedId);
              return (
                <option key={t.id} value={t.id}>
                  {t.name} (Room {room?.roomNumber}, Bed {bed?.label})
                </option>
              );
            })}
          </select>
        </div>

        {/* Charge selection */}
        {tenantId && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Monthly Rent Charge *
            </label>
            <select
              value={chargeId}
              onChange={(e) => setChargeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {tenantCharges.map((c) => {
                const paid = state.payments
                  .filter((p) => p.chargeId === c.id)
                  .reduce((sum, p) => sum + p.amount, 0);
                const bal = c.amount - paid;
                return (
                  <option key={c.id} value={c.id}>
                    {formatBillingMonth(c.billingMonth)}: Total {formatINR(c.amount)} • Paid {formatINR(paid)} • Balance {formatINR(bal)}
                  </option>
                );
              })}
            </select>

            {selectedCharge && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Month Charge:</span>
                  <span className="font-semibold text-slate-900">{formatINR(selectedCharge.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Previously Paid:</span>
                  <span className="font-semibold text-slate-900">{formatINR(alreadyPaid)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span className="text-slate-700">Remaining Balance:</span>
                  <span className={balanceRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {formatINR(balanceRemaining)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Payment Amount to Receive (INR) *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IndianRupee className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="1"
              max={balanceRemaining || undefined}
              step="50"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Enter amount (partial or full)"
              className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>Supports partial payment. Overpayment is rejected.</span>
            {balanceRemaining > 0 && (
              <button
                type="button"
                onClick={() => setAmount(balanceRemaining)}
                className="text-brand-600 font-semibold hover:underline"
              >
                Pay Full ({formatINR(balanceRemaining)})
              </button>
            )}
          </div>
        </div>

        {/* Date & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Mode *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
              <option value="Cash">Cash at Reception</option>
              <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
            </select>
          </div>
        </div>

        {/* Transaction Reference */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Transaction Reference / UTR (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. UPI/628049583721"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono text-xs"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Payment Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Cleared via PhonePe"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting || balanceRemaining === 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Confirm & Generate Receipt
          </button>
        </div>
      </form>
    </Modal>
  );
};

