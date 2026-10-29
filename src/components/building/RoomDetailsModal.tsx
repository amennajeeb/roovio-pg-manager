import React from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Room } from '../../types';
import { formatINR } from '../../utils/currency';
import { BedStatusBadge } from '../common/Badge';
import {
  Bath,
  Wind,
  Layers,
  Bed as BedIcon,
  Wifi,
  Sparkles,
  User,
  Clock,
  Archive,
  Package,
  DoorClosed,
  CheckCircle2,
  Calendar,
  Info,
} from 'lucide-react';

interface RoomDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onOpenEdit: () => void;
  onOpenLifecycle: () => void;
}

export const RoomDetailsModal: React.FC<RoomDetailsModalProps> = ({
  isOpen,
  onClose,
  room,
  onOpenEdit,
  onOpenLifecycle,
}) => {
  const { state } = useData();

  const floor = state.floors.find((f) => f.id === room.floorId);
  const property = state.properties?.find((p) => p.id === room.propertyId) || state.property;

  const activeTenants = state.tenants.filter(
    (t) => t.roomId === room.id && (t.status === 'active' || t.status === 'notice')
  );

  const pastTenants = state.tenants.filter(
    (t) =>
      (t.roomId === room.id && t.status === 'checked_out') ||
      t.stayHistory?.some((s) => s.roomNumber === room.roomNumber && s.action !== 'joined')
  );

  const linkedTickets = state.maintenanceTickets.filter((m) => m.roomId === room.id);

  const purpose = room.roomPurpose || 'accommodation';
  const opStatus = room.operationalStatus || (room.status === 'inactive' ? 'closed' : room.status === 'maintenance' ? 'maintenance' : 'available');

  const amenities = room.amenities || room.amenitiesList;
  const amenityList: string[] = [];
  if (amenities?.wifi) amenityList.push('High-Speed Wi-Fi');
  if (amenities?.geyser) amenityList.push('Hot Water Geyser');
  if (amenities?.cupboard) amenityList.push('Cupboard / Wardrobe');
  if (amenities?.studyTable || amenities?.table) amenityList.push('Study Table');
  if (amenities?.chair) amenityList.push('Study Chair');
  if (amenities?.fan) amenityList.push('Ceiling Fan');
  if (amenities?.tv) amenityList.push('Television');
  if (room.hasBalcony) amenityList.push('Private Balcony');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Room ${room.roomNumber} Overview & Details`}
      description={`${property.name} • ${floor?.name || 'Floor'}`}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {/* Top KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Room Purpose</span>
            <span className="font-bold text-slate-900 capitalize text-sm">
              {purpose}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Operational Status</span>
            <span
              className={`font-bold capitalize text-sm ${
                opStatus === 'available'
                  ? 'text-emerald-700'
                  : opStatus === 'storage'
                  ? 'text-amber-700'
                  : opStatus === 'closed'
                  ? 'text-slate-700'
                  : 'text-rose-700'
              }`}
            >
              {opStatus.replace('_', ' ')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Sharing & Capacity</span>
            <span className="font-bold text-slate-900 text-sm">
              {room.beds.length} Total Berths
            </span>
            <span className="text-[10px] text-slate-400 block">{room.sharingType}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Standard Rent Baseline</span>
            <span className="font-bold text-slate-900 text-sm font-mono">
              {room.roomRent ? `${formatINR(room.roomRent)}/mo (room)` : `From ${formatINR(room.beds[0]?.monthlyRent || 0)}/mo`}
            </span>
          </div>
        </div>

        {/* Operational Status Reason if not available */}
        {opStatus !== 'available' && room.statusReason && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Status Note: {room.statusReason}</span>
              {room.statusEffectiveDate && (
                <span className="text-[11px] text-amber-700">Effective from: {room.statusEffectiveDate}</span>
              )}
              {room.statusNotes && <p className="text-[11px] mt-0.5">{room.statusNotes}</p>}
            </div>
          </div>
        )}

        {/* Facilities & Amenities */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
            Room Facilities & Climate
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-1 rounded-md font-semibold border ${room.hasAc ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {room.hasAc ? 'Air Conditioned (AC)' : 'Non-AC'}
            </span>
            <span className="px-2 py-1 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {room.hasAttachedBathroom || room.bathroomType === 'attached' ? 'Attached Bathroom' : 'Shared Bathroom'}
            </span>
            {room.hasBalcony && (
              <span className="px-2 py-1 rounded-md font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Attached Balcony
              </span>
            )}
            {amenityList.map((am) => (
              <span key={am} className="px-2 py-1 rounded-md bg-white text-slate-700 border border-slate-200">
                {am}
              </span>
            ))}
          </div>
        </div>

        {/* Berths & Current Resident Allocations */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Sleeping Berths & Current Occupants ({activeTenants.length}/{room.beds.length} Occupied)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {room.beds.map((b) => {
              const occupant = activeTenants.find((t) => t.bedId === b.id);
              return (
                <div
                  key={b.id}
                  className={`p-2.5 rounded-lg border ${
                    occupant ? 'bg-brand-50/50 border-brand-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{b.label}</span>
                    <BedStatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Standard: {formatINR(b.monthlyRent)}/mo</span>
                    {occupant && (
                      <span className="font-mono font-bold text-brand-700">
                        Agreed: {formatINR(occupant.monthlyRent)}/mo
                      </span>
                    )}
                  </div>
                  {occupant && (
                    <div className="mt-1 pt-1 border-t border-brand-200/60 text-[11px] text-slate-700 flex items-center justify-between">
                      <span className="font-semibold">{occupant.name}</span>
                      <span className="text-slate-500 font-mono">{occupant.phone}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Historical Occupancy & Maintenance Logs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Past Resident Records ({pastTenants.length})
            </span>
            {pastTenants.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No past checked-out resident records for this room.</p>
            ) : (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {pastTenants.slice(0, 5).map((pt) => (
                  <div key={pt.id} className="text-[11px] text-slate-600 flex justify-between">
                    <span>{pt.name}</span>
                    <span className="text-slate-400">Checked out: {pt.actualCheckoutDate || 'Past'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              Maintenance History ({linkedTickets.length})
            </span>
            {linkedTickets.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No maintenance tickets logged for this room.</p>
            ) : (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {linkedTickets.map((t) => (
                  <div key={t.id} className="text-[11px] text-slate-600 flex justify-between">
                    <span className="truncate pr-2">{t.title}</span>
                    <span className={`capitalize font-semibold ${t.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLifecycle();
            }}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5 text-slate-600" />
            <span>Manage Lifecycle & Deletion</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEdit();
              }}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              Edit Room & Facilities
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

