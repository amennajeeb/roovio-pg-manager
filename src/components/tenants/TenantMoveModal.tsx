import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Tenant } from '../../types';
import { formatINR } from '../../utils/currency';
import { AlertCircle, Layers } from 'lucide-react';

interface TenantMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
}

export const TenantMoveModal: React.FC<TenantMoveModalProps> = ({ isOpen, onClose, tenant }) => {
  const { state, moveTenantBed } = useData();

  const [targetRoomId, setTargetRoomId] = useState('');
  const [targetBedId, setTargetBedId] = useState('');
  const [moveDate, setMoveDate] = useState(state.demoDate);
  const [notes, setNotes] = useState('');
  const [rentUpdateOption, setRentUpdateOption] = useState<'update' | 'keep'>('keep');
  const [error, setError] = useState<string | null>(null);

  if (!tenant) return null;

  const currentRoom = state.rooms.find((r) => r.id === tenant.roomId);
  const currentBed = currentRoom?.beds.find((b) => b.id === tenant.bedId);

  // Filter only active accommodation rooms that are not closed, storage, or retired
  const roomsWithVacantBeds = state.rooms.filter(
    (r) =>
      (r.roomPurpose === 'accommodation' || !r.roomPurpose) &&
      r.operationalStatus !== 'closed' &&
      r.operationalStatus !== 'storage' &&
      r.operationalStatus !== 'retired' &&
      r.status !== 'inactive' &&
      r.beds.some((b) => b.status === 'vacant')
  );

  const selectedTargetRoom = state.rooms.find((r) => r.id === targetRoomId);
  const vacantBedsInTarget = selectedTargetRoom
    ? selectedTargetRoom.beds.filter((b) => b.status === 'vacant')
    : [];
  const selectedTargetBed = selectedTargetRoom?.beds.find((b) => b.id === targetBedId);

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetRoomId || !targetBedId) {
      setError('Please select both a target room and an available sleeping berth.');
      return;
    }

    const newRent = rentUpdateOption === 'update' && selectedTargetBed ? selectedTargetBed.monthlyRent : tenant.monthlyRent;
    const rentReason =
      newRent !== tenant.monthlyRent
        ? `Reallocated from Room ${currentRoom?.roomNumber || ''} to Room ${selectedTargetRoom?.roomNumber || ''} (${selectedTargetBed?.label || ''}). Rent updated to ₹${newRent}/mo.`
        : notes || `Reallocated to Room ${selectedTargetRoom?.roomNumber || ''} (${selectedTargetBed?.label || ''})`;

    const result = moveTenantBed(tenant.id, targetRoomId, targetBedId, moveDate, notes, {
      newRent,
      reason: rentReason,
    });

    if (!result.success) {
      setError(result.error || 'Failed to move berth.');
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reallocate Tenant Berth"
      description={`Move ${tenant.name} to another room or berth`}
      maxWidth="md"
    >
      <form onSubmit={handleMove} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Bed Info */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="text-slate-500 block">Current Assignment:</span>
          <span className="font-bold text-slate-900 text-sm">
            Room {currentRoom?.roomNumber} • {currentBed?.label} ({currentBed?.bedType === 'bunk' ? `${currentBed.tier} berth` : 'single bed'})
          </span>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{currentBed?.id}</div>
        </div>

        {/* Target Room */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Target Room *
          </label>
          <select
            value={targetRoomId}
            onChange={(e) => {
              setTargetRoomId(e.target.value);
              setTargetBedId('');
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          >
            <option value="">-- Choose Target Room --</option>
            {roomsWithVacantBeds.map((r) => {
              const floor = state.floors.find((f) => f.id === r.floorId);
              const vacantCount = r.beds.filter((b) => b.status === 'vacant').length;
              return (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber} ({floor?.name}) • {r.sharingType} ({vacantCount} vacant berths)
                </option>
              );
            })}
          </select>
        </div>

        {/* Target Berth Selection */}
        {selectedTargetRoom && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Vacant Berth in Room {selectedTargetRoom.roomNumber} *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {vacantBedsInTarget.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setTargetBedId(b.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    targetBedId === b.id
                      ? 'border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-500 font-bold'
                      : 'border-slate-300 hover:border-brand-400 bg-white text-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>
                      {b.bedType === 'bunk' ? (
                        b.tier === 'upper' ? 'Upper Berth' : 'Lower Berth'
                      ) : (
                        b.label
                      )}
                    </span>
                    <span className="text-[10px] tabular-nums font-mono text-slate-600">
                      {formatINR(b.monthlyRent)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {b.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rent Differential & Agreement Option if Target Berth Chosen */}
        {selectedTargetBed && (
          <div className="p-3 bg-brand-50/60 border border-brand-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-brand-900">
              <span>Accommodation Rent Comparison</span>
              <span className="font-mono text-xs">
                {selectedTargetBed.monthlyRent === tenant.monthlyRent ? (
                  <span className="text-slate-600">Same Rate ({formatINR(tenant.monthlyRent)})</span>
                ) : selectedTargetBed.monthlyRent > tenant.monthlyRent ? (
                  <span className="text-amber-800">+{formatINR(selectedTargetBed.monthlyRent - tenant.monthlyRent)}/mo</span>
                ) : (
                  <span className="text-emerald-800">-{formatINR(tenant.monthlyRent - selectedTargetBed.monthlyRent)}/mo</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-brand-200/60">
              <div>
                <span className="block text-slate-400">Current Agreed Rent:</span>
                <span className="font-mono font-bold text-slate-800">{formatINR(tenant.monthlyRent)}/mo</span>
              </div>
              <div>
                <span className="block text-slate-400">Target Standard Rent:</span>
                <span className="font-mono font-bold text-slate-800">{formatINR(selectedTargetBed.monthlyRent)}/mo</span>
              </div>
            </div>

            {selectedTargetBed.monthlyRent !== tenant.monthlyRent && (
              <div className="pt-2 border-t border-brand-200/60 space-y-1.5">
                <span className="block font-bold text-slate-700 text-[11px]">Pricing Agreement on Transfer:</span>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rentUpdateOption"
                      checked={rentUpdateOption === 'keep'}
                      onChange={() => setRentUpdateOption('keep')}
                      className="text-brand-600"
                    />
                    <span>Keep current agreed rent ({formatINR(tenant.monthlyRent)}/mo)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rentUpdateOption"
                      checked={rentUpdateOption === 'update'}
                      onChange={() => setRentUpdateOption('update')}
                      className="text-brand-600"
                    />
                    <span>Update agreement to destination standard rent ({formatINR(selectedTargetBed.monthlyRent)}/mo)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Move Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Effective Move Date *
          </label>
          <input
            type="date"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        {/* Reason / Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Reason / Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Moved from upper berth to lower berth on tenant request"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        {/* Buttons */}
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
            disabled={!targetBedId}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Confirm Berth Movement
          </button>
        </div>
      </form>
    </Modal>
  );
};
