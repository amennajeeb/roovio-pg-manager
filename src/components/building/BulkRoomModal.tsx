import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { SharingType, BedType, BathroomType, PricingBasis, RoomAmenities } from '../../types';
import { formatINR } from '../../utils/currency';
import {
  Layers,
  Zap,
  CheckCircle2,
  AlertCircle,
  Wind,
  Bath,
  Wifi,
  Sparkles,
  Bed as BedIcon,
  HelpCircle,
} from 'lucide-react';

interface BulkRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  floorId: string;
  onSuccess?: () => void;
}

export const BulkRoomModal: React.FC<BulkRoomModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  floorId,
  onSuccess,
}) => {
  const { state, bulkGenerateRooms } = useData();

  const buildingFloors = state.floors.filter((f) => f.propertyId === propertyId);

  const [selectedFloorId, setSelectedFloorId] = useState(floorId || buildingFloors[0]?.id || '');
  const [startNumber, setStartNumber] = useState<number>(101);
  const [count, setCount] = useState<number>(4);
  const [prefix, setPrefix] = useState('');

  // Room Configuration
  const [sharingType, setSharingType] = useState<SharingType>('Double');
  const [bedType, setBedType] = useState<BedType>('bunk');

  // Pricing
  const [upperRent, setUpperRent] = useState<number>(6000);
  const [lowerRent, setLowerRent] = useState<number>(6500);
  const [singleRent, setSingleRent] = useState<number>(7000);

  // Facilities & Amenities
  const [hasAc, setHasAc] = useState(false);
  const [bathroomType, setBathroomType] = useState<BathroomType>('attached');
  const [amenities, setAmenities] = useState<RoomAmenities>({
    cupboard: true,
    table: true,
    chair: true,
    fan: true,
    wifi: true,
    geyser: true,
    balcony: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Derive berths per room
  const berthsPerRoom = useMemo(() => {
    switch (sharingType) {
      case 'Single':
        return 1;
      case 'Double':
        return 2;
      case 'Triple':
        return 3;
      case 'Four':
        return 4;
      default:
        return 2;
    }
  }, [sharingType]);

  // Check for duplicate room numbers upfront
  const previewRoomNumbers = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.push(`${prefix.trim()}${startNumber + i}`);
    }
    return list;
  }, [prefix, startNumber, count]);

  const duplicateConflicts = useMemo(() => {
    return previewRoomNumbers.filter((num) =>
      state.rooms.some(
        (r) =>
          (r.propertyId === propertyId ||
            state.floors.find((f) => f.id === r.floorId)?.propertyId === propertyId) &&
          r.roomNumber.toLowerCase() === num.toLowerCase()
      )
    );
  }, [previewRoomNumbers, state.rooms, state.floors, propertyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (count < 1 || count > 50) {
      setError('Please choose between 1 and 50 rooms to generate.');
      return;
    }

    if (startNumber < 1) {
      setError('Starting room number must be a positive integer.');
      return;
    }

    if (bedType === 'bunk') {
      if (upperRent <= 0 || lowerRent <= 0) {
        setError('Berth rents must be greater than ₹0.');
        return;
      }
    } else {
      if (singleRent <= 0) {
        setError('Single bed rent must be greater than ₹0.');
        return;
      }
    }

    if (duplicateConflicts.length > 0) {
      setError(
        `Room number collision: Room ${duplicateConflicts.join(', ')} already exists in this building. Adjust the start number or prefix.`
      );
      return;
    }

    const res = bulkGenerateRooms({
      propertyId,
      floorId: selectedFloorId,
      startNumber,
      count,
      prefix: prefix.trim(),
      sharingType,
      pricingBasis: 'per_person',
      bedType,
      upperRent,
      lowerRent,
      singleRent,
      hasAc,
      hasAttachedBathroom: bathroomType === 'attached',
      bathroomType,
      amenitiesList: amenities,
      foodPlan: 'no_food', // Meals belong exclusively to individual tenants
      foodMonthlyCharge: 0,
      mealsProvided: { breakfast: false, lunch: false, dinner: false },
    });

    if (!res.success) {
      setError(res.error || 'Failed to generate rooms.');
      return;
    }

    setSuccessMsg(`Successfully generated ${res.createdCount} rooms with ${res.createdCount * berthsPerRoom} berths!`);
    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 900);
  };

  const toggleAmenity = (key: keyof RoomAmenities) => {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Generate Rooms"
      description="Quickly provision multiple standard rooms and individual berths on a floor"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Section 1: Room Numbering */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-600" />
              1. Floor & Numbering Sequence
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              Generating {count} rooms ({count * berthsPerRoom} berths)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Floor</label>
              <select
                value={selectedFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {buildingFloors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Prefix <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. A-, G-"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Number</label>
              <input
                type="number"
                min="1"
                required
                value={startNumber}
                onChange={(e) => setStartNumber(parseInt(e.target.value, 10) || 101)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Room Count</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={count}
                onChange={(e) => setCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Sequence Preview Pill */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-500">
            <span className="font-medium text-slate-600">Preview:</span>
            {previewRoomNumbers.slice(0, 6).map((num) => {
              const isCollision = duplicateConflicts.includes(num);
              return (
                <span
                  key={num}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    isCollision
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {num}
                  {isCollision ? ' (Exists)' : ''}
                </span>
              );
            })}
            {previewRoomNumbers.length > 6 && (
              <span className="text-[10px] text-slate-400">...+{previewRoomNumbers.length - 6} more</span>
            )}
          </div>
        </div>

        {/* Section 2: Room Configuration & Berth Pricing */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              2. Sharing & Berth Accommodation Pricing
            </span>
            <span className="text-[10px] text-slate-500">
              *Meals configured per tenant at onboarding
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Sharing Type & Capacity
              </label>
              <select
                value={sharingType}
                onChange={(e) => setSharingType(e.target.value as SharingType)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="Single">Single Occupancy (1 Bed)</option>
                <option value="Double">Double Sharing (2 Beds)</option>
                <option value="Triple">Triple Sharing (3 Beds)</option>
                <option value="Four">Four Sharing (4 Beds)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Bed Arrangement
              </label>
              <select
                value={bedType}
                onChange={(e) => setBedType(e.target.value as BedType)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="bunk">Bunk Beds (Upper & Lower Berths)</option>
                <option value="single">Single Physical Beds</option>
              </select>
            </div>
          </div>

          {/* Conditional Pricing Fields */}
          {bedType === 'bunk' ? (
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/60">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Upper Berth Monthly Rent
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    value={upperRent}
                    onChange={(e) => setUpperRent(parseInt(e.target.value, 10) || 0)}
                    className="w-full pl-6 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Lower Berth Monthly Rent
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    value={lowerRent}
                    onChange={(e) => setLowerRent(parseInt(e.target.value, 10) || 0)}
                    className="w-full pl-6 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-1 border-t border-slate-200/60">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Standard Bed Monthly Rent
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  step="100"
                  min="1"
                  value={singleRent}
                  onChange={(e) => setSingleRent(parseInt(e.target.value, 10) || 0)}
                  className="w-full pl-6 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Facilities & Amenities */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Bath className="w-3.5 h-3.5 text-brand-600" />
            3. Facilities & Furnishings
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Bathroom Setup
              </label>
              <select
                value={bathroomType}
                onChange={(e) => setBathroomType(e.target.value as BathroomType)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="attached">Attached Bathroom</option>
                <option value="shared">Shared Bathroom</option>
                <option value="none">Common Floor Bathroom</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasAc}
                  onChange={(e) => setHasAc(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-brand-600" />
                  Air Conditioned (AC Room)
                </span>
              </label>
            </div>
          </div>

          {/* Quick Amenities Checklist */}
          <div className="pt-2 border-t border-slate-200/60">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Included Furnishings & Amenities
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
              {[
                { key: 'wifi' as const, label: 'Wi-Fi' },
                { key: 'geyser' as const, label: 'Geyser' },
                { key: 'cupboard' as const, label: 'Cupboard' },
                { key: 'table' as const, label: 'Desk' },
                { key: 'fan' as const, label: 'Ceiling Fan' },
                { key: 'balcony' as const, label: 'Balcony' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer select-none transition-colors ${
                    amenities[key]
                      ? 'bg-brand-50 border-brand-200 text-brand-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(amenities[key])}
                    onChange={() => toggleAmenity(key)}
                    className="sr-only"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Concise Summary Bar */}
        <div className="p-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs flex items-center justify-between text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Configured Accommodation:</span>{' '}
            {bedType === 'bunk'
              ? `Upper: ${formatINR(upperRent)}/mo • Lower: ${formatINR(lowerRent)}/mo`
              : `Single: ${formatINR(singleRent)}/mo`}
          </div>
          <span className="text-[11px] text-slate-500">
            {count} rooms • {count * berthsPerRoom} berths total
          </span>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={duplicateConflicts.length > 0}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Generate {count} Rooms</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
