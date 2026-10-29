import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import {
  Room,
  Bed,
  SharingType,
  RoomStatus,
  BathroomType,
  PricingBasis,
  RoomAmenities,
  RoomPurpose,
  OperationalStatus,
} from '../../types';
import { formatINR } from '../../utils/currency';
import { BedStatusBadge } from '../common/Badge';
import { SafeRoomDeleteModal } from './SafeRoomDeleteModal';
import {
  AlertCircle,
  Trash2,
  Plus,
  Layers,
  Bed as BedIcon,
  Bath,
  Wind,
  Sparkles,
  Wifi,
  Edit2,
  Check,
  Package,
  DoorClosed,
  Archive,
  Info,
  Calendar,
} from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomToEdit?: Room;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, roomToEdit }) => {
  const {
    state,
    addRoom,
    updateRoom,
    deleteRoom,
    addBunkBedToRoom,
    removeBunkBedFromRoom,
    addSingleBedToRoom,
    deleteBed,
    updateBerthRent,
  } = useData();

  const [activeTab, setActiveTab] = useState<'details' | 'beds' | 'facilities'>('details');

  // Room Details
  const [floorId, setFloorId] = useState(roomToEdit?.floorId || state.floors[0]?.id || '');
  const [roomNumber, setRoomNumber] = useState(roomToEdit?.roomNumber || '');
  const [sharingType, setSharingType] = useState<SharingType>(roomToEdit?.sharingType || 'Double');
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>(roomToEdit?.pricingBasis || 'per_person');
  const [roomRent, setRoomRent] = useState<number | undefined>(roomToEdit?.roomRent);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>(roomToEdit?.status || 'available');
  const [roomNotes, setRoomNotes] = useState(roomToEdit?.notes || '');

  // Room Purpose and Lifecycle
  const [roomPurpose, setRoomPurpose] = useState<RoomPurpose>(roomToEdit?.roomPurpose || 'accommodation');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>(
    roomToEdit?.operationalStatus || 'available'
  );
  const [statusReason, setStatusReason] = useState<string>(roomToEdit?.statusReason || '');
  const [statusEffectiveDate, setStatusEffectiveDate] = useState<string>(
    roomToEdit?.statusEffectiveDate || new Date().toISOString().split('T')[0]
  );
  const [statusNotes, setStatusNotes] = useState<string>(roomToEdit?.statusNotes || '');

  // Bed configuration for new rooms
  const [bunkBedCount, setBunkBedCount] = useState<number>(1);
  const [upperBerthRent, setUpperBerthRent] = useState<number>(6000);
  const [lowerBerthRent, setLowerBerthRent] = useState<number>(6500);
  const [singleBedCount, setSingleBedCount] = useState<number>(1);
  const [singleBedRent, setSingleBedRent] = useState<number>(7000);

  // Edit mode inline bed additions
  const [showAddBunkInline, setShowAddBunkInline] = useState(false);
  const [newBunkName, setNewBunkName] = useState('Bunk 2');
  const [newUpperRent, setNewUpperRent] = useState(6000);
  const [newLowerRent, setNewLowerRent] = useState(6500);

  const [showAddSingleInline, setShowAddSingleInline] = useState(false);
  const [newSingleLabel, setNewSingleLabel] = useState('Single Bed 2');
  const [newSingleRent, setNewSingleRent] = useState(7000);

  // Facilities & Amenities
  const [hasAc, setHasAc] = useState(roomToEdit?.hasAc ?? false);
  const [hasBalcony, setHasBalcony] = useState(roomToEdit?.hasBalcony ?? false);
  const [bathroomType, setBathroomType] = useState<BathroomType>(
    roomToEdit?.bathroomType || (roomToEdit?.hasAttachedBathroom ? 'attached' : 'shared')
  );
  const [amenities, setAmenities] = useState<RoomAmenities>(
    roomToEdit?.amenitiesList || {
      cupboard: true,
      table: true,
      chair: true,
      fan: true,
      wifi: true,
      geyser: true,
      balcony: roomToEdit?.hasBalcony ?? false,
      tv: false,
    }
  );

  const [error, setError] = useState<string | null>(null);
  const [isSafeDeleteModalOpen, setIsSafeDeleteModalOpen] = useState(false);

  // Active occupants in this room
  const activeOccupants = useMemo(() => {
    if (!roomToEdit) return [];
    return state.tenants.filter(
      (t) => t.roomId === roomToEdit.id && (t.status === 'active' || t.status === 'notice')
    );
  }, [roomToEdit, state.tenants]);

  // Group beds in roomToEdit by Bunk vs Single
  const bunkGroups = useMemo(() => {
    if (!roomToEdit) return {};
    const groups: Record<string, Bed[]> = {};
    roomToEdit.beds
      .filter((b) => b.bedType === 'bunk' && b.bunkGroup)
      .forEach((b) => {
        const g = b.bunkGroup!;
        if (!groups[g]) groups[g] = [];
        groups[g].push(b);
      });
    return groups;
  }, [roomToEdit]);

  const singleBeds = useMemo(() => {
    if (!roomToEdit) return [];
    return roomToEdit.beds.filter((b) => b.bedType === 'single');
  }, [roomToEdit]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roomNumber.trim()) {
      setError('Room number is required.');
      return;
    }

    if (roomPurpose === 'accommodation' && bunkBedCount === 0 && singleBedCount === 0) {
      setError('An accommodation room must contain at least 1 single bed or 1 bunk bed.');
      return;
    }

    // Build beds array
    const bedsToAdd: any[] = [];
    if (roomPurpose === 'accommodation') {
      for (let i = 1; i <= bunkBedCount; i++) {
        const group = `Bunk ${i}`;
        bedsToAdd.push({
          label: `${group} - Lower`,
          bedType: 'bunk',
          bunkGroup: group,
          tier: 'lower',
          monthlyRent: lowerBerthRent,
        });
        bedsToAdd.push({
          label: `${group} - Upper`,
          bedType: 'bunk',
          bunkGroup: group,
          tier: 'upper',
          monthlyRent: upperBerthRent,
        });
      }

      for (let j = 1; j <= singleBedCount; j++) {
        bedsToAdd.push({
          label: `Single Bed ${j}`,
          bedType: 'single',
          tier: 'single',
          monthlyRent: singleBedRent,
        });
      }
    }

    const totalBerths = bedsToAdd.length;
    const sharingTypeDesc =
      roomPurpose === 'storage'
        ? 'Storage Room'
        : roomPurpose === 'maintenance'
        ? 'Maintenance Room'
        : roomPurpose === 'staff'
        ? 'Staff Room'
        : `${totalBerths}-Sharing (${bunkBedCount > 0 ? `${bunkBedCount} Bunk` : ''}${
            bunkBedCount > 0 && singleBedCount > 0 ? ' + ' : ''
          }${singleBedCount > 0 ? `${singleBedCount} Single` : ''})`;

    const initialStatus: RoomStatus =
      operationalStatus === 'closed'
        ? 'closed'
        : operationalStatus === 'storage'
        ? 'storage'
        : operationalStatus === 'retired'
        ? 'retired'
        : operationalStatus === 'maintenance'
        ? 'maintenance'
        : 'available';

    const res = addRoom({
      floorId,
      roomNumber: roomNumber.trim(),
      sharingType: sharingTypeDesc,
      capacity: totalBerths,
      pricingBasis,
      hasAc,
      hasAttachedBathroom: bathroomType === 'attached',
      hasBalcony,
      bathroomType,
      roomRent,
      status: initialStatus,
      notes: roomNotes.trim(),
      amenitiesList: amenities,
      foodPlan: 'no_food',
      mealsProvided: { breakfast: false, lunch: false, dinner: false },
      foodMonthlyCharge: 0,
      beds: bedsToAdd,
      roomPurpose,
      operationalStatus,
      statusReason: operationalStatus !== 'available' ? statusReason : undefined,
      statusEffectiveDate: operationalStatus !== 'available' ? statusEffectiveDate : undefined,
      statusNotes: operationalStatus !== 'available' ? statusNotes : undefined,
    });

    if (!res.success) {
      setError(res.error || 'Failed to create room.');
      return;
    }

    onClose();
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomToEdit) return;
    setError(null);

    // Validation: cannot change purpose or status to non-accommodation if active occupants exist
    if (
      activeOccupants.length > 0 &&
      (roomPurpose !== 'accommodation' ||
        operationalStatus === 'closed' ||
        operationalStatus === 'storage' ||
        operationalStatus === 'retired')
    ) {
      setError(
        `Cannot change room status to "${operationalStatus}" or purpose to "${roomPurpose}" because it currently has ${activeOccupants.length} active resident(s). Please transfer them or record their departure first.`
      );
      return;
    }

    const newStatus: RoomStatus =
      operationalStatus === 'closed'
        ? 'closed'
        : operationalStatus === 'storage'
        ? 'storage'
        : operationalStatus === 'retired'
        ? 'retired'
        : operationalStatus === 'maintenance'
        ? 'maintenance'
        : activeOccupants.length >= roomToEdit.beds.length && roomToEdit.beds.length > 0
        ? 'full'
        : activeOccupants.length > 0
        ? 'partially_occupied'
        : 'available';

    const res = updateRoom(roomToEdit.id, {
      roomNumber: roomNumber.trim(),
      floorId,
      sharingType,
      pricingBasis,
      hasAc,
      hasAttachedBathroom: bathroomType === 'attached',
      hasBalcony,
      bathroomType,
      roomRent,
      status: newStatus,
      notes: roomNotes.trim(),
      amenitiesList: amenities,
      roomPurpose,
      operationalStatus,
      statusReason: operationalStatus !== 'available' ? statusReason : undefined,
      statusEffectiveDate: operationalStatus !== 'available' ? statusEffectiveDate : undefined,
      statusNotes: operationalStatus !== 'available' ? statusNotes : undefined,
      // Preserve existing room-level food metadata
      foodPlan: roomToEdit.foodPlan || 'no_food',
      mealsProvided: roomToEdit.mealsProvided,
      mealPrices: roomToEdit.mealPrices,
      foodMonthlyCharge: roomToEdit.foodMonthlyCharge || 0,
    });

    if (!res.success) {
      setError(res.error || 'Failed to update room.');
      return;
    }

    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={roomToEdit ? `Configure Room ${roomToEdit.roomNumber}` : 'Add New Room'}
        description={
          roomToEdit
            ? 'Manage room lifecycle, berth arrangements, facilities, and standard pricing'
            : 'Define room occupancy, bed arrangements, bathroom, and amenities'
        }
        maxWidth="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Occupancy Notice in Edit Mode */}
          {roomToEdit && activeOccupants.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  This room currently has {activeOccupants.length} active resident(s):
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {activeOccupants.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center px-2 py-0.5 bg-white border border-blue-200 rounded-md text-[11px] font-medium text-blue-800"
                    >
                      {t.name} ({roomToEdit.beds.find((b) => b.id === t.bedId)?.label || 'Bed'})
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-blue-700">
                  Standard rent adjustments here only affect future occupants. Existing resident agreements will not be modified.
                </p>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Room & Lifecycle</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('beds')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'beds'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BedIcon className="w-3.5 h-3.5" />
              <span>Beds & Pricing</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('facilities')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'facilities'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Bath className="w-3.5 h-3.5" />
              <span>Facilities</span>
            </button>
          </div>

          {/* TAB 1: ROOM & LIFECYCLE */}
          {activeTab === 'details' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Room Number / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 101 or A-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Floor Assignment *
                  </label>
                  <select
                    value={floorId}
                    onChange={(e) => setFloorId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900"
                  >
                    {state.floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room Purpose & Operational Status */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-brand-600" />
                  <span>Room Purpose & Operational Status</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Room Purpose
                    </label>
                    <select
                      value={roomPurpose}
                      onChange={(e) => {
                        const nextPurpose = e.target.value as RoomPurpose;
                        setRoomPurpose(nextPurpose);
                        if (nextPurpose === 'storage') {
                          setOperationalStatus('storage');
                        } else if (nextPurpose === 'maintenance') {
                          setOperationalStatus('maintenance');
                        } else if (nextPurpose === 'accommodation' && operationalStatus === 'storage') {
                          setOperationalStatus('available');
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900"
                    >
                      <option value="accommodation">Accommodation (Tenant Rooms)</option>
                      <option value="storage">Storage Room (Supplies, Mattresses, Goods)</option>
                      <option value="maintenance">Maintenance / Utility Room</option>
                      <option value="staff">Staff / Caretaker Room</option>
                      <option value="other">Other Commercial / Facility Use</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Operational Status
                    </label>
                    <select
                      value={operationalStatus}
                      onChange={(e) => {
                        const nextStatus = e.target.value as OperationalStatus;
                        setOperationalStatus(nextStatus);
                        if (nextStatus === 'storage') setRoomPurpose('storage');
                        if (nextStatus === 'maintenance') setRoomPurpose('maintenance');
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900"
                    >
                      <option value="available">Available / Active</option>
                      <option value="closed">Temporarily Closed</option>
                      <option value="maintenance">Under Maintenance / Repairs</option>
                      <option value="storage">Converted to Storage</option>
                      <option value="retired">Retired / Out of Service</option>
                    </select>
                  </div>
                </div>

                {operationalStatus !== 'available' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Reason for Status Change
                        </label>
                        <input
                          type="text"
                          value={statusReason}
                          onChange={(e) => setStatusReason(e.target.value)}
                          placeholder="e.g. Painting, converted to linen store"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Effective Date
                        </label>
                        <input
                          type="date"
                          value={statusEffectiveDate}
                          onChange={(e) => setStatusEffectiveDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Operational Notes
                      </label>
                      <input
                        type="text"
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        placeholder="Expected reopening date or additional details..."
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Basis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pricing Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingBasis('per_person')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      pricingBasis === 'per_person'
                        ? 'border-brand-600 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">Per Person / Berth</p>
                    <p className="text-[11px] text-slate-500">Each occupant pays their specific berth rate</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingBasis('per_room')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      pricingBasis === 'per_room'
                        ? 'border-brand-600 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-bold">Whole Room Flat Rent</p>
                    <p className="text-[11px] text-slate-500">Fixed rate for entire room</p>
                  </button>
                </div>
              </div>

              {pricingBasis === 'per_room' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Whole Room Monthly Rent (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={roomRent || ''}
                    onChange={(e) => setRoomRent(Number(e.target.value) || undefined)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  General Notes
                </label>
                <textarea
                  value={roomNotes}
                  onChange={(e) => setRoomNotes(e.target.value)}
                  placeholder="e.g. Corner room with large window..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>
          )}

          {/* TAB 2: BEDS & PRICING */}
          {activeTab === 'beds' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Standard Berth Rent:</strong> Modifying standard rents sets the baseline for new allocations. Existing resident agreements and payment history will <strong>never</strong> be modified automatically.
                </span>
              </div>

              {/* Edit Mode: List Existing Beds */}
              {roomToEdit ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Configured Berths ({roomToEdit.beds.length})
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowAddBunkInline(!showAddBunkInline)}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Bunk</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddSingleInline(!showAddSingleInline)}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Single</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Bunk Bed */}
                  {showAddBunkInline && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-slate-800">Add Bunk Bed Pair</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Bunk Name</label>
                          <input
                            type="text"
                            value={newBunkName}
                            onChange={(e) => setNewBunkName(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Upper Rent (₹)</label>
                          <input
                            type="number"
                            value={newUpperRent}
                            onChange={(e) => setNewUpperRent(Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Lower Rent (₹)</label>
                          <input
                            type="number"
                            value={newLowerRent}
                            onChange={(e) => setNewLowerRent(Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddBunkInline(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addBunkBedToRoom(roomToEdit.id, {
                              bunkGroup: newBunkName,
                              upperRent: newUpperRent,
                              lowerRent: newLowerRent,
                            });
                            setShowAddBunkInline(false);
                          }}
                          className="px-3 py-1 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700"
                        >
                          Add Pair
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Add Single Bed */}
                  {showAddSingleInline && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-slate-800">Add Single Bed</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Bed Label</label>
                          <input
                            type="text"
                            value={newSingleLabel}
                            onChange={(e) => setNewSingleLabel(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Monthly Rent (₹)</label>
                          <input
                            type="number"
                            value={newSingleRent}
                            onChange={(e) => setNewSingleRent(Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddSingleInline(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addSingleBedToRoom(roomToEdit.id, {
                              label: newSingleLabel,
                              monthlyRent: newSingleRent,
                            });
                            setShowAddSingleInline(false);
                          }}
                          className="px-3 py-1 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700"
                        >
                          Add Bed
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing Bed List */}
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {roomToEdit.beds.map((bed) => {
                      const occupant = state.tenants.find(
                        (t) => t.bedId === bed.id && (t.status === 'active' || t.status === 'notice')
                      );
                      return (
                        <div
                          key={bed.id}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{bed.label}</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono capitalize">
                              {bed.tier || bed.bedType}
                            </span>
                            {occupant ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-semibold">
                                Occupied: {occupant.name}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-semibold">
                                Vacant
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 text-[11px]">Rent:</span>
                              <input
                                type="number"
                                defaultValue={bed.monthlyRent}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val > 0 && val !== bed.monthlyRent) {
                                    updateBerthRent(roomToEdit.id, bed.id, val);
                                  }
                                }}
                                className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg text-right font-semibold"
                              />
                            </div>
                            {!occupant ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Remove vacant berth ${bed.label}?`)) {
                                    deleteBed(roomToEdit.id, bed.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Remove vacant bed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                title="Cannot delete occupied bed. Transfer tenant first."
                                className="p-1 text-slate-300 cursor-not-allowed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Create Mode: Configure initial bunks and singles */
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-slate-800">Bunk Beds (Double-deck)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Number of Bunks
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={bunkBedCount}
                          onChange={(e) => setBunkBedCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Lower Berth Rent (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={lowerBerthRent}
                          onChange={(e) => setLowerBerthRent(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Upper Berth Rent (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={upperBerthRent}
                          onChange={(e) => setUpperBerthRent(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-slate-800">Single Standard Beds</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Number of Single Beds
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={singleBedCount}
                          onChange={(e) => setSingleBedCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Monthly Rent per Single Bed (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={singleBedRent}
                          onChange={(e) => setSingleBedRent(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FACILITIES */}
          {activeTab === 'facilities' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Bathroom Arrangement
                  </label>
                  <select
                    value={bathroomType}
                    onChange={(e) => setBathroomType(e.target.value as BathroomType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900"
                  >
                    <option value="attached">Attached Bathroom</option>
                    <option value="shared">Shared / Common Bathroom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Climate Control
                  </label>
                  <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAc}
                      onChange={(e) => setHasAc(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">Air Conditioned (AC Room)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Room Amenities & Inventory Checklist
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.cupboard}
                      onChange={(e) => setAmenities({ ...amenities, cupboard: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Wardrobe / Cupboard</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.table}
                      onChange={(e) => setAmenities({ ...amenities, table: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Study Table</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.chair}
                      onChange={(e) => setAmenities({ ...amenities, chair: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Study Chair</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.fan}
                      onChange={(e) => setAmenities({ ...amenities, fan: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Ceiling Fan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.wifi}
                      onChange={(e) => setAmenities({ ...amenities, wifi: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>High-Speed Wi-Fi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.geyser}
                      onChange={(e) => setAmenities({ ...amenities, geyser: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Hot Water Geyser</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={hasBalcony}
                      onChange={(e) => {
                        setHasBalcony(e.target.checked);
                        setAmenities({ ...amenities, balcony: e.target.checked });
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>Balcony</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={!!amenities.tv}
                      onChange={(e) => setAmenities({ ...amenities, tv: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Television (TV)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              {roomToEdit && (
                <button
                  type="button"
                  onClick={() => setIsSafeDeleteModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Retire or Delete Room...</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={roomToEdit ? handleUpdateSubmit : handleCreateSubmit}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                {roomToEdit ? 'Save Changes' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Safe Room Delete / Retire Modal */}
      {roomToEdit && isSafeDeleteModalOpen && (
        <SafeRoomDeleteModal
          isOpen={isSafeDeleteModalOpen}
          onClose={() => setIsSafeDeleteModalOpen(false)}
          room={roomToEdit}
          onRoomDeletedOrRetired={() => {
            setIsSafeDeleteModalOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
