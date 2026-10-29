import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Bed, Room, BedStatus } from '../../types';
import { useData } from '../../persistence/DataContext';
import { BedStatusBadge } from '../common/Badge';
import { formatINR } from '../../utils/currency';
import { AlertCircle, Wrench, CheckCircle, IndianRupee, Layers } from 'lucide-react';

interface BedDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed: Bed;
  room: Room;
}

export const BedDetailsModal: React.FC<BedDetailsModalProps> = ({ isOpen, onClose, bed, room }) => {
  const { state, setBedStatus, updateBerthRent } = useData();

  const [status, setStatus] = useState<BedStatus>(bed.status);
  const [maintenanceReason, setMaintenanceReason] = useState(bed.maintenanceReason || '');
  const [monthlyRent, setMonthlyRent] = useState<number>(bed.monthlyRent || 6500);
  const [error, setError] = useState<string | null>(null);

  const tenant = bed.currentTenantId
    ? state.tenants.find((t) => t.id === bed.currentTenantId)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Update rent if changed
    if (monthlyRent !== bed.monthlyRent) {
      const rentRes = updateBerthRent(room.id, bed.id, monthlyRent);
      if (!rentRes.success) {
        setError(rentRes.error || 'Failed to update berth rent.');
        return;
      }
    }

    // Update status if changed
    if (status !== bed.status || maintenanceReason !== bed.maintenanceReason) {
      const res = setBedStatus(bed.id, status, maintenanceReason);
      if (!res.success) {
        setError(res.error || 'Failed to update berth availability.');
        return;
      }
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={bed.label}
      description={`Unique Berth ID: ${bed.id}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Berth Type:</span>
            <span className="font-bold text-slate-800 flex items-center gap-1">
              {bed.bedType === 'bunk' ? (
                <>
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  <span>
                    {bed.bunkGroup} • {bed.tier === 'upper' ? 'Upper Berth' : 'Lower Berth'}
                  </span>
                </>
              ) : (
                <span>Single Bed</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Current Status:</span>
            <BedStatusBadge status={bed.status} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Room Location:</span>
            <span className="font-semibold text-slate-800">
              Room {room.roomNumber} ({room.sharingType})
            </span>
          </div>

          {tenant && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500">Assigned Tenant:</span>
              <span className="font-bold text-brand-700">{tenant.name}</span>
            </div>
          )}
        </div>

        {/* Berth Rent Configuration */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Configured Berth Monthly Rent (INR) *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IndianRupee className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="0"
              step="100"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(Number(e.target.value))}
              className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Pre-filled when onboarding a tenant into this {bed.tier || 'bed'} space.
          </p>
        </div>

        {/* Availability controls */}
        {bed.status === 'occupied' || bed.status === 'notice' ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
            This berth has an active tenant. To free or reassign this berth, use <strong>Check Out</strong> or <strong>Move Bed</strong> from the tenant's profile drawer.
          </div>
        ) : (
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Berth Availability Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('vacant')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    status === 'vacant'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Vacant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('maintenance')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    status === 'maintenance'
                      ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Wrench className="w-4 h-4 text-rose-600" />
                  <span>Maintenance</span>
                </button>
              </div>
            </div>

            {status === 'maintenance' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Maintenance Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ladder weld repair, mattress sanitization"
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>

          <button
            type="submit"
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Save Berth Settings
          </button>
        </div>
      </form>
    </Modal>
  );
};
