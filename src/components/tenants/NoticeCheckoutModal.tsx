import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Tenant } from '../../types';
import { formatINR } from '../../utils/currency';
import { AlertCircle, ClipboardCheck } from 'lucide-react';

interface NoticeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  mode: 'notice' | 'checkout';
}

export const NoticeCheckoutModal: React.FC<NoticeCheckoutModalProps> = ({
  isOpen,
  onClose,
  tenant,
  mode,
}) => {
  const { state, giveNotice, checkoutTenant } = useData();

  // Notice fields
  const [noticeDate, setNoticeDate] = useState(state.demoDate);
  const [expectedMoveOutDate, setExpectedMoveOutDate] = useState('2026-11-29');

  // Checkout fields
  const [checkoutDate, setCheckoutDate] = useState(state.demoDate);
  const [refundDepositAmount, setRefundDepositAmount] = useState<number>(tenant.depositReceived || 0);
  const [inventoryConditions, setInventoryConditions] = useState<Record<string, 'Good' | 'Fair' | 'Damaged' | 'Missing'>>(() => {
    const initial: Record<string, 'Good' | 'Fair' | 'Damaged' | 'Missing'> = {};
    tenant.assignedInventory.forEach((item) => {
      initial[item.id] = (item.condition === 'New' ? 'Good' : item.condition) as any;
    });
    return initial;
  });

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!tenant) return null;

  const handleNoticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedMoveOutDate) {
      setError('Please provide expected move-out date.');
      return;
    }
    giveNotice(tenant.id, noticeDate, expectedMoveOutDate, notes);
    onClose();
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refundDepositAmount > tenant.depositReceived) {
      setError(`Refund amount cannot exceed received deposit of ${formatINR(tenant.depositReceived)}.`);
      return;
    }
    checkoutTenant(tenant.id, checkoutDate, inventoryConditions, refundDepositAmount, notes);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'notice' ? 'Record Tenant Notice' : 'Tenant Checkout & Bed Release'}
      description={`Update status for ${tenant.name}`}
      maxWidth="md"
    >
      {mode === 'notice' ? (
        <form onSubmit={handleNoticeSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <strong>Notice Policy:</strong> The tenant's bed will change to status <strong>Notice</strong>, but remains counted as occupied until the formal checkout date.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notice Submission Date *
              </label>
              <input
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expected Vacate Date *
              </label>
              <input
                type="date"
                value={expectedMoveOutDate}
                onChange={(e) => setExpectedMoveOutDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Notice Reason / Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Relocating to new branch, completed course"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Confirm Notice Period
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCheckoutSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            <strong>Bed Release:</strong> Completing checkout immediately releases the bed back to <strong>Vacant</strong> for new tenant allocation while preserving complete historical records.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Actual Checkout Date *
            </label>
            <input
              type="date"
              value={checkoutDate}
              onChange={(e) => setCheckoutDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Inventory checklist inspection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-brand-600" />
              Room Inventory Inspection at Checkout
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              {tenant.assignedInventory.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 border-b border-slate-200/50 last:border-none">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <select
                    value={inventoryConditions[item.id] || 'Good'}
                    onChange={(e) =>
                      setInventoryConditions((prev) => ({
                        ...prev,
                        [item.id]: e.target.value as any,
                      }))
                    }
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Missing">Missing</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Deposit settlement */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Deposit Received at Check-in:</span>
              <span className="font-bold text-slate-900">{formatINR(tenant.depositReceived)}</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Refund Amount Returned to Tenant (INR)
              </label>
              <input
                type="number"
                min="0"
                max={tenant.depositReceived}
                value={refundDepositAmount}
                onChange={(e) => setRefundDepositAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold tabular-nums text-emerald-800"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Remaining deduction will be recorded for repairs or dues settlement.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Final Checkout Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Keys returned, clearance verified"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Complete Checkout & Release Bed
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

