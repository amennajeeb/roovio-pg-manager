import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Room, Tenant, Bed } from '../../types';
import { formatINR } from '../../utils/currency';
import {
  AlertTriangle,
  ArrowRightLeft,
  LogOut,
  Archive,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Layers,
  DoorClosed,
  Package,
} from 'lucide-react';

interface SafeRoomDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onRoomDeletedOrRetired?: () => void;
}

export const SafeRoomDeleteModal: React.FC<SafeRoomDeleteModalProps> = ({
  isOpen,
  onClose,
  room,
  onRoomDeletedOrRetired,
}) => {
  const {
    state,
    moveTenantBed,
    checkoutTenant,
    retireRoom,
    closeRoom,
    convertToStorage,
    deleteRoom,
  } = useData();

  // Find active occupants in this room
  const activeOccupants = state.tenants.filter(
    (t) => t.roomId === room.id && (t.status === 'active' || t.status === 'notice')
  );

  // Find historical occupants (past tenants who stayed in this room or checked out)
  const historicalOccupants = state.tenants.filter(
    (t) =>
      (t.roomId === room.id && t.status === 'checked_out') ||
      t.stayHistory?.some((s) => s.roomNumber === room.roomNumber && s.action !== 'joined')
  );

  // Find linked maintenance tickets
  const linkedTickets = state.maintenanceTickets.filter((m) => m.roomId === room.id);

  // Active resolution tab for occupied rooms
  const [resolutionMode, setResolutionMode] = useState<'transfer' | 'departure'>('transfer');

  // Transfer state
  const [selectedTenantId, setSelectedTenantId] = useState<string>(activeOccupants[0]?.id || '');
  const [targetRoomId, setTargetRoomId] = useState('');
  const [targetBedId, setTargetBedId] = useState('');
  const [transferDate, setTransferDate] = useState(state.demoDate);
  const [transferNotes, setTransferNotes] = useState('');
  const [rentUpdateOption, setRentUpdateOption] = useState<'keep' | 'update'>('keep');

  // Departure state
  const [departingTenantId, setDepartingTenantId] = useState<string>(activeOccupants[0]?.id || '');
  const [departureDate, setDepartureDate] = useState(state.demoDate);
  const [departureReason, setDepartureReason] = useState('Moving out / Relocation');
  const [departureNotes, setDepartureNotes] = useState('');
  const [departureConfirmed, setDepartureConfirmed] = useState(false);

  // Empty room retirement / deletion state
  const [emptyAction, setEmptyAction] = useState<'retire' | 'close' | 'storage' | 'delete'>('retire');
  const [actionReason, setActionReason] = useState('Room closure for property optimization');
  const [actionNotes, setActionNotes] = useState('');
  const [forceDeleteConfirmed, setForceDeleteConfirmed] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Available destination rooms for transfer
  const destinationRooms = state.rooms.filter(
    (r) =>
      r.id !== room.id &&
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

  const tenantToTransfer = state.tenants.find((t) => t.id === selectedTenantId);
  const tenantToDepart = state.tenants.find((t) => t.id === departingTenantId);

  // Handler for Option A: Transfer Tenant
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedTenantId || !targetRoomId || !targetBedId) {
      setFeedback({ type: 'error', message: 'Please select a resident, destination room, and available berth.' });
      return;
    }

    const newRent =
      rentUpdateOption === 'update' && selectedTargetBed ? selectedTargetBed.monthlyRent : tenantToTransfer?.monthlyRent;
    const rentReason =
      newRent !== tenantToTransfer?.monthlyRent
        ? `Transferred from Room ${room.roomNumber} to Room ${selectedTargetRoom?.roomNumber} due to room lifecycle change. Rent updated to ₹${newRent}/mo.`
        : transferNotes || `Transferred from Room ${room.roomNumber} to Room ${selectedTargetRoom?.roomNumber}`;

    const res = moveTenantBed(selectedTenantId, targetRoomId, targetBedId, transferDate, transferNotes, {
      newRent,
      reason: rentReason,
    });

    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'Failed to transfer resident.' });
    } else {
      setFeedback({
        type: 'success',
        message: `Successfully transferred ${tenantToTransfer?.name} to Room ${selectedTargetRoom?.roomNumber} (${selectedTargetBed?.label}).`,
      });
      // Reset transfer inputs
      setTargetBedId('');
      const remaining = activeOccupants.filter((t) => t.id !== selectedTenantId);
      if (remaining.length > 0) {
        setSelectedTenantId(remaining[0].id);
        setDepartingTenantId(remaining[0].id);
      }
    }
  };

  // Handler for Option B: Genuine Tenant Departure
  const handleExecuteDeparture = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!departingTenantId) {
      setFeedback({ type: 'error', message: 'Please select a resident.' });
      return;
    }

    if (!departureConfirmed) {
      setFeedback({
        type: 'error',
        message: 'Please explicitly confirm that this resident has genuinely departed from the PG.',
      });
      return;
    }

    checkoutTenant(
      departingTenantId,
      departureDate,
      {},
      0,
      `Genuine departure recorded: ${departureReason}. ${departureNotes}`.trim()
    );

    setFeedback({
      type: 'success',
      message: `Successfully recorded checkout and departure for ${tenantToDepart?.name}. Berth released.`,
    });

    setDepartureConfirmed(false);
    const remaining = activeOccupants.filter((t) => t.id !== departingTenantId);
    if (remaining.length > 0) {
      setSelectedTenantId(remaining[0].id);
      setDepartingTenantId(remaining[0].id);
    }
  };

  // Handler for Empty Room Actions (Retire, Close, Storage, Delete)
  const handleExecuteEmptyAction = () => {
    setFeedback(null);

    if (emptyAction === 'retire') {
      const res = retireRoom(room.id, actionReason, state.demoDate, actionNotes);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to retire room.' });
      } else {
        onRoomDeletedOrRetired?.();
        onClose();
      }
    } else if (emptyAction === 'close') {
      const res = closeRoom(room.id, actionReason, state.demoDate, actionNotes);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to close room.' });
      } else {
        onRoomDeletedOrRetired?.();
        onClose();
      }
    } else if (emptyAction === 'storage') {
      const res = convertToStorage(room.id, actionReason, state.demoDate, actionNotes);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to convert room to storage.' });
      } else {
        onRoomDeletedOrRetired?.();
        onClose();
      }
    } else if (emptyAction === 'delete') {
      const hasHistory = historicalOccupants.length > 0 || linkedTickets.length > 0;
      if (hasHistory && !forceDeleteConfirmed) {
        setFeedback({
          type: 'error',
          message: 'This room has historical records. Please check the confirmation checkbox to acknowledge permanent deletion, or choose Retire Room instead.',
        });
        return;
      }

      const res = deleteRoom(room.id, true);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to delete room.' });
      } else {
        onRoomDeletedOrRetired?.();
        onClose();
      }
    }
  };

  const isOccupied = activeOccupants.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Room Lifecycle & Deletion — Room ${room.roomNumber}`}
      description="Safely resolve occupants, preserve historical financial records, or retire room"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Room Status Summary Card */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Room Number</span>
            <span className="font-bold text-slate-900 text-sm">Room {room.roomNumber}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Current Occupancy</span>
            <span
              className={`font-bold text-sm ${
                isOccupied ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {activeOccupants.length} Active {activeOccupants.length === 1 ? 'Resident' : 'Residents'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Past Stay Records</span>
            <span className="font-bold text-slate-800 text-sm">{historicalOccupants.length} History Logs</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Maintenance Logs</span>
            <span className="font-bold text-slate-800 text-sm">{linkedTickets.length} Tickets</span>
          </div>
        </div>

        {/* SCENARIO 1: ROOM HAS ACTIVE OCCUPANTS */}
        {isOccupied ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">Room Cannot Be Deleted or Closed Immediately</span>
                <p className="mt-0.5 text-amber-800">
                  Room {room.roomNumber} currently has <strong>{activeOccupants.length} active resident(s)</strong> assigned.
                  To protect tenants from accidental eviction and prevent broken accounting, you must resolve all current
                  occupants first using <strong>Transfer Residents</strong> or <strong>Record Departure</strong>.
                </p>
              </div>
            </div>

            {/* List Current Occupants */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 flex justify-between items-center">
                <span>Active Residents Requiring Resolution ({activeOccupants.length}):</span>
                <span className="text-[11px] font-normal text-slate-500">Select an action below</span>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {activeOccupants.map((occ) => {
                  const b = room.beds.find((bed) => bed.id === occ.bedId);
                  return (
                    <div key={occ.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">{occ.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {b?.label || 'Berth'} • Phone: {occ.phone} • Joined: {occ.joiningDate}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-brand-700">
                        {formatINR(occ.monthlyRent)}/mo
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resolution Options Tabs */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setResolutionMode('transfer')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  resolutionMode === 'transfer'
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Option A: Transfer to Another Room</span>
              </button>
              <button
                type="button"
                onClick={() => setResolutionMode('departure')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                  resolutionMode === 'departure'
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Option B: Record Genuine Departure (Checkout)</span>
              </button>
            </div>

            {/* OPTION A: TRANSFER RESIDENT FORM */}
            {resolutionMode === 'transfer' && (
              <form onSubmit={handleExecuteTransfer} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Resident to Transfer *</label>
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      {activeOccupants.map((occ) => (
                        <option key={occ.id} value={occ.id}>
                          {occ.name} ({formatINR(occ.monthlyRent)}/mo)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Destination Room *</label>
                    <select
                      value={targetRoomId}
                      onChange={(e) => {
                        setTargetRoomId(e.target.value);
                        setTargetBedId('');
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      <option value="">-- Choose Destination Room --</option>
                      {destinationRooms.map((r) => {
                        const floor = state.floors.find((f) => f.id === r.floorId);
                        const vac = r.beds.filter((b) => b.status === 'vacant').length;
                        return (
                          <option key={r.id} value={r.id}>
                            Room {r.roomNumber} ({floor?.name}) • {r.sharingType} ({vac} vacant berths)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Target Berth Selection */}
                {selectedTargetRoom && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Select Available Berth in Room {selectedTargetRoom.roomNumber} *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {vacantBedsInTarget.map((b) => (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => setTargetBedId(b.id)}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            targetBedId === b.id
                              ? 'border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-500 font-bold'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                          }`}
                        >
                          <span className="block font-semibold text-xs">{b.label}</span>
                          <span className="block text-[10px] font-mono text-slate-500">
                            {formatINR(b.monthlyRent)}/mo
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rent Differential Comparison */}
                {selectedTargetBed && tenantToTransfer && (
                  <div className="p-2.5 bg-white border border-brand-200 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-brand-900">Rent Differential:</span>
                      <span className="font-mono text-xs font-bold">
                        {selectedTargetBed.monthlyRent === tenantToTransfer.monthlyRent ? (
                          <span className="text-slate-600">No change ({formatINR(tenantToTransfer.monthlyRent)})</span>
                        ) : selectedTargetBed.monthlyRent > tenantToTransfer.monthlyRent ? (
                          <span className="text-amber-800">+{formatINR(selectedTargetBed.monthlyRent - tenantToTransfer.monthlyRent)}/mo</span>
                        ) : (
                          <span className="text-emerald-800">-{formatINR(tenantToTransfer.monthlyRent - selectedTargetBed.monthlyRent)}/mo</span>
                        )}
                      </span>
                    </div>

                    {selectedTargetBed.monthlyRent !== tenantToTransfer.monthlyRent && (
                      <div className="pt-1.5 border-t border-slate-100 flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="rentOpt"
                            checked={rentUpdateOption === 'keep'}
                            onChange={() => setRentUpdateOption('keep')}
                            className="text-brand-600"
                          />
                          <span>Keep current rent ({formatINR(tenantToTransfer.monthlyRent)}/mo)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="rentOpt"
                            checked={rentUpdateOption === 'update'}
                            onChange={() => setRentUpdateOption('update')}
                            className="text-brand-600"
                          />
                          <span>Apply new berth rent ({formatINR(selectedTargetBed.monthlyRent)}/mo)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Effective Transfer Date *</label>
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Reason / Audit Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Reassigned due to room maintenance"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={!targetBedId}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow-2xs transition-colors disabled:opacity-40"
                  >
                    Transfer Resident & Free Berth
                  </button>
                </div>
              </form>
            )}

            {/* OPTION B: GENUINE DEPARTURE FORM */}
            {resolutionMode === 'departure' && (
              <form onSubmit={handleExecuteDeparture} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px]">
                  <strong>Notice:</strong> Only record a departure if the resident is genuinely moving out of the PG.
                  All payment history and past invoices will remain fully preserved in historical records.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Resident Departing *</label>
                    <select
                      value={departingTenantId}
                      onChange={(e) => setDepartingTenantId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      {activeOccupants.map((occ) => (
                        <option key={occ.id} value={occ.id}>
                          {occ.name} ({formatINR(occ.monthlyRent)}/mo)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Departure Reason *</label>
                    <select
                      value={departureReason}
                      onChange={(e) => setDepartureReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      <option value="Moving out / Relocation">Moving out / Job Relocation</option>
                      <option value="Personal Reasons">Personal / Family Reasons</option>
                      <option value="End of College Term">End of College Term</option>
                      <option value="Shifting to Private Flat">Shifting to Private Flat</option>
                      <option value="Disciplinary / Other">Other Reason</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Actual Checkout Date *</label>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Departure Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Cleared room keys and returned deposit"
                      value={departureNotes}
                      onChange={(e) => setDepartureNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={departureConfirmed}
                      onChange={(e) => setDepartureConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>I confirm this resident has genuinely vacated and checked out of the PG</span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={!departureConfirmed}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-2xs transition-colors disabled:opacity-40"
                  >
                    Confirm Checkout & Release Berth
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* SCENARIO 2: ROOM HAS 0 OCCUPANTS — SAFE RESOLUTION OPTIONS */
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">Room is Currently Vacant & Ready for Lifecycle Action</span>
                <p className="mt-0.5 text-emerald-800">
                  There are no active residents in Room {room.roomNumber}. You may safely close, convert to storage, retire,
                  or permanently delete the room.
                </p>
              </div>
            </div>

            {/* Choose Action */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                Select Action:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    emptyAction === 'retire'
                      ? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-500 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="emptyAction"
                      checked={emptyAction === 'retire'}
                      onChange={() => setEmptyAction('retire')}
                      className="text-brand-600"
                    />
                    <Archive className="w-4 h-4 text-brand-600" />
                    <span className="font-bold text-slate-900">Retire Room (Recommended)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6 font-normal">
                    Permanently closes the room from active operations while preserving 100% of historical tenant and
                    accounting logs.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    emptyAction === 'storage'
                      ? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-500 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="emptyAction"
                      checked={emptyAction === 'storage'}
                      onChange={() => setEmptyAction('storage')}
                      className="text-brand-600"
                    />
                    <Package className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-slate-900">Convert to Storage</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6 font-normal">
                    Repurposes the room for linen, luggage, or supplies. Excludes berths from accommodation capacity.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    emptyAction === 'close'
                      ? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-500 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="emptyAction"
                      checked={emptyAction === 'close'}
                      onChange={() => setEmptyAction('close')}
                      className="text-brand-600"
                    />
                    <DoorClosed className="w-4 h-4 text-slate-600" />
                    <span className="font-bold text-slate-900">Temporarily Close Room</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6 font-normal">
                    Closes the room for renovation, painting, or seasonal vacancy. Can be reopened at any time.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    emptyAction === 'delete'
                      ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-500 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="emptyAction"
                      checked={emptyAction === 'delete'}
                      onChange={() => setEmptyAction('delete')}
                      className="text-rose-600"
                    />
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-rose-900">Permanently Delete Room</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6 font-normal">
                    Removes the room entity entirely from the building. Only recommended if created by mistake.
                  </p>
                </label>
              </div>

              {/* Action Reason and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reason for Action *</label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operational Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Converting for hostel linen storage"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Delete Warning & Confirmation if Permanent Deletion is Chosen */}
              {emptyAction === 'delete' && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-rose-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Permanent Deletion Warning</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Deleting Room {room.roomNumber} permanently deletes its records. If you only want to take the room out
                    of service, <strong>Retire Room</strong> is strongly advised so financial receipts and history are
                    unaffected.
                  </p>
                  {(historicalOccupants.length > 0 || linkedTickets.length > 0) && (
                    <div className="p-2 bg-white/80 rounded border border-rose-200 text-[11px]">
                      <strong>Note:</strong> This room has {historicalOccupants.length} past resident records and{' '}
                      {linkedTickets.length} maintenance tickets.
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs pt-1">
                    <input
                      type="checkbox"
                      checked={forceDeleteConfirmed}
                      onChange={(e) => setForceDeleteConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>I understand and wish to permanently delete this room</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteEmptyAction}
                disabled={emptyAction === 'delete' && (historicalOccupants.length > 0 || linkedTickets.length > 0) && !forceDeleteConfirmed}
                className={`px-5 py-2 font-bold rounded-xl text-xs shadow-xs transition-colors ${
                  emptyAction === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40'
                    : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
              >
                {emptyAction === 'retire' && 'Confirm Room Retirement'}
                {emptyAction === 'close' && 'Confirm Room Closure'}
                {emptyAction === 'storage' && 'Confirm Storage Conversion'}
                {emptyAction === 'delete' && 'Permanently Delete Room'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

