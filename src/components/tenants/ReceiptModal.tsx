import React from 'react';
import { Modal } from '../common/Modal';
import { PaymentRecord, Tenant, Property, RentCharge } from '../../types';
import { formatINR } from '../../utils/currency';
import { formatIndianDate, formatBillingMonth } from '../../utils/date';
import { Printer, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord;
  tenant: Tenant;
  property: Property;
  charge: RentCharge;
  remainingBalance: number;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  tenant,
  property,
  charge,
  remainingBalance,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Receipt"
      description={`Receipt #${payment.receiptNumber}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Printable Card Area */}
        <div id="printable-receipt" className="print-card bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-900">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 rounded mb-1.5">
                Demo Receipt • Local Record
              </span>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {property.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{property.address}</p>
              <p className="text-xs text-slate-500">Contact: {property.phone} • UPI: {property.upiId}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Receipt No:</div>
              <div className="text-sm font-bold font-mono text-slate-900">{payment.receiptNumber}</div>
              <div className="text-xs text-slate-500 mt-1">Date: {formatIndianDate(payment.paymentDate)}</div>
            </div>
          </div>

          {/* Tenant & Room details */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Received From:</span>
              <span className="font-bold text-slate-900 text-sm">{tenant.name}</span>
              <span className="text-slate-500 block mt-0.5">Phone: {tenant.phone}</span>
              <span className="text-slate-700 font-medium block mt-0.5">Berth: {tenant.bedId}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Billing Period:</span>
              <span className="font-semibold text-slate-800">{formatBillingMonth(payment.billingMonth)}</span>
              <span className="text-slate-500 block mt-0.5">Due Date: {formatIndianDate(charge.dueDate)}</span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="py-4 border-b border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Rent Charge for {formatBillingMonth(payment.billingMonth)}</span>
              <span className="font-semibold tabular-nums">{formatINR(charge.amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-800 font-bold text-sm bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Amount Received ({payment.paymentMethod})
              </span>
              <span className="tabular-nums">{formatINR(payment.amount)}</span>
            </div>
            {payment.transactionRef && (
              <div className="flex justify-between text-slate-500 text-[11px] px-1">
                <span>Transaction Ref:</span>
                <span className="font-mono">{payment.transactionRef}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-700 font-medium pt-1 border-t border-slate-200/60">
              <span>Remaining Rent Balance:</span>
              <span className={`tabular-nums font-bold ${remainingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatINR(remainingBalance)}
              </span>
            </div>
          </div>

          {payment.notes && (
            <div className="pt-3 text-[11px] text-slate-500">
              <span className="font-semibold">Notes:</span> {payment.notes}
            </div>
          )}

          <div className="mt-4 pt-3 text-center border-t border-slate-200 text-[10px] text-slate-400">
            This is a computer-generated operations receipt for ROOVIO PG Manager.
          </div>
        </div>

        {/* Action buttons (hidden when printing) */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors focus:ring-2 focus:ring-brand-500"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

