import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ArrowRight, Bed as BedIcon, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { Room, Floor, Bed, Tenant } from '../../types';

interface FloorBedMatrixOverviewProps {
  rooms: Room[];
  floors: Floor[];
  tenants: Tenant[];
  className?: string;
}

/**
 * Format sharing type into readable label
 */
function formatSharingType(type: string): string {
  switch (type?.toLowerCase()) {
    case 'single':
      return 'Single Room';
    case 'double':
      return 'Double Sharing';
    case 'triple':
      return 'Triple Sharing';
    case 'four':
      return '4-Sharing';
    case 'dormitory':
      return 'Dormitory';
    default:
      return type ? `${type} Sharing` : 'Standard';
  }
}

/**
 * Generate a clean, compact, non-overflowing berth code and metadata
 */
function getBerthMeta(bed: Bed, index: number) {
  let shortCode = '';
  let tierLabel = 'Single';

  if (bed.bedType === 'bunk') {
    // Extract bunk number if available (e.g., "Bunk 1" -> "1")
    const match = bed.bunkGroup?.match(/\d+/);
    const bunkNum = match ? match[0] : `${Math.floor(index / 2) + 1}`;

    if (bed.tier === 'upper') {
      shortCode = `B${bunkNum}·U`;
      tierLabel = 'Upper Berth';
    } else if (bed.tier === 'lower') {
      shortCode = `B${bunkNum}·L`;
      tierLabel = 'Lower Berth';
    } else {
      shortCode = `B${bunkNum}`;
      tierLabel = 'Bunk Berth';
    }
  } else {
    shortCode = `Bed ${index + 1}`;
    tierLabel = 'Single Bed';
  }

  return { shortCode, tierLabel };
}

/**
 * Floor & Bed Matrix Overview Component
 * 
 * Production-ready room and berth occupancy matrix featuring:
 * 1. Room Number + full Floor name header (no overlapping, no truncation)
 * 2. Dedicated Bed Matrix flex container with accessible, color-coded berth indicators
 * 3. Structured footer with sharing type and cleanly formatted occupancy counts
 * 4. Fully responsive grid tested from 320px mobile to 4K desktop
 */
export const FloorBedMatrixOverview: React.FC<FloorBedMatrixOverviewProps> = ({
  rooms,
  floors,
  tenants,
  className = '',
}) => {
  const navigate = useNavigate();
  const [selectedFloorId, setSelectedFloorId] = useState<string>('all');

  // Filter rooms based on floor selection
  const filteredRooms = useMemo(() => {
    if (selectedFloorId === 'all') {
      return rooms;
    }
    return rooms.filter((r) => r.floorId === selectedFloorId);
  }, [rooms, selectedFloorId]);

  // Overall statistics for active accommodation rooms
  const totalBerths = useMemo(() => {
    return rooms.reduce((acc, r) => acc + (r.beds?.length || 0), 0);
  }, [rooms]);

  const vacantBerths = useMemo(() => {
    return rooms.reduce((acc, r) => {
      return acc + (r.beds?.filter((b) => b.status === 'vacant').length || 0);
    }, 0);
  }, [rooms]);

  const occupiedBerths = useMemo(() => {
    return rooms.reduce((acc, r) => {
      return acc + (r.beds?.filter((b) => b.status === 'occupied' || b.status === 'notice').length || 0);
    }, 0);
  }, [rooms]);

  return (
    <div
      className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between ${className}`}
      data-testid="floor-bed-matrix-overview"
    >
      {/* 1. Header & Summary Controls */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Floor & Bed Matrix Overview</span>
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
              {rooms.length} Rooms • {totalBerths} Berths across {floors.length} Floors
              <span className="hidden sm:inline font-medium text-slate-600">
                {' '}({vacantBerths} vacant, {occupiedBerths} occupied)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/building')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100/80 px-2.5 py-1.5 rounded-lg transition-colors border border-brand-200/60"
            >
              <span>Full Building Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Interactive Floor Selector & Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
          {/* Floor Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full scrollbar-none" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={selectedFloorId === 'all'}
              onClick={() => setSelectedFloorId('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                selectedFloorId === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
              }`}
            >
              All Floors ({rooms.length})
            </button>
            {floors.map((floor) => {
              const count = rooms.filter((r) => r.floorId === floor.id).length;
              return (
                <button
                  key={floor.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedFloorId === floor.id}
                  onClick={() => setSelectedFloorId(floor.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                    selectedFloorId === floor.id
                      ? 'bg-brand-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  {floor.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-medium shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
              <span>Vacant</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1F5C4E] ring-2 ring-brand-100" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100" />
              <span>Notice</span>
            </div>
          </div>
        </div>

        {/* 3. Responsive Room Cards Grid */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filteredRooms.map((room) => {
            const floor = floors.find((f) => f.id === room.floorId);
            const floorDisplayName = floor?.name || (floor?.number !== undefined ? `Floor ${floor.number}` : 'Floor 1');

            const vacantCount = room.beds?.filter((b) => b.status === 'vacant').length || 0;
            const occupiedCount = room.beds?.filter((b) => b.status === 'occupied').length || 0;
            const noticeCount = room.beds?.filter((b) => b.status === 'notice').length || 0;
            const totalRoomBeds = room.beds?.length || 0;

            const isStorage = room.roomPurpose === 'storage' || room.operationalStatus === 'storage' || room.status === 'storage';
            const isClosed = room.operationalStatus === 'closed' || room.status === 'closed';
            const isRetired = room.operationalStatus === 'retired' || room.status === 'retired';

            // Concise occupancy summary line
            let occupancySummary = '';
            if (isStorage || isClosed || isRetired) {
              occupancySummary = 'Off-service';
            } else if (vacantCount === 0) {
              occupancySummary = `${totalRoomBeds} occupied (Full)`;
            } else if (occupiedCount === 0 && noticeCount === 0) {
              occupancySummary = `All ${totalRoomBeds} vacant`;
            } else {
              const activeCount = occupiedCount + noticeCount;
              occupancySummary = `${activeCount} occupied · ${vacantCount} vacant`;
            }

            return (
              <div
                key={room.id}
                onClick={() => navigate('/building')}
                className={`p-3 bg-white border rounded-xl hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group min-w-0 ${
                  isStorage
                    ? 'border-amber-200 bg-amber-50/20'
                    : isClosed
                    ? 'border-rose-200 bg-rose-50/20'
                    : isRetired
                    ? 'border-slate-300 opacity-75'
                    : 'border-slate-200 hover:border-brand-300'
                }`}
                title={`Click to view Room ${room.roomNumber} in Building Matrix`}
              >
                {/* AREA 1: HEADER (Room Number left, Full Floor Name right) */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-brand-700 transition-colors truncate">
                      Room {room.roomNumber}
                    </span>
                    {isStorage && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300 shrink-0">
                        Storage
                      </span>
                    )}
                    {isClosed && (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100/80 px-1.5 py-0.2 rounded border border-rose-300 shrink-0">
                        Closed
                      </span>
                    )}
                    {isRetired && (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-1.5 py-0.2 rounded border border-slate-300 shrink-0">
                        Retired
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0 border border-slate-200/70 truncate max-w-[120px]">
                    {floorDisplayName}
                  </span>
                </div>

                {/* AREA 2: BED MATRIX (Dedicated flex-wrap container with clean indicators) */}
                <div className="py-2.5 min-h-[46px] flex flex-col justify-center">
                  {isStorage || isClosed || isRetired ? (
                    <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {isStorage ? 'Storage facility room' : isClosed ? 'Temporarily closed' : 'Retired from service'}
                      </span>
                    </div>
                  ) : totalRoomBeds === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">No berths configured</div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 flex-wrap"
                      role="list"
                      aria-label={`Berths in Room ${room.roomNumber}`}
                    >
                      {room.beds.map((b, idx) => {
                        const { shortCode, tierLabel } = getBerthMeta(b, idx);
                        const tenant = b.currentTenantId ? tenants.find((t) => t.id === b.currentTenantId) : null;

                        let statusBg = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                        let statusText = 'Vacant';

                        if (b.status === 'occupied') {
                          statusBg = 'bg-[#1F5C4E] text-white border-[#17483D]';
                          statusText = 'Occupied';
                        } else if (b.status === 'notice') {
                          statusBg = 'bg-amber-100 text-amber-900 border-amber-300';
                          statusText = 'Notice Period';
                        } else if (b.status === 'maintenance') {
                          statusBg = 'bg-rose-100 text-rose-800 border-rose-300';
                          statusText = 'Maintenance';
                        }

                        return (
                          <div
                            key={b.id}
                            role="listitem"
                            title={`${b.label} (${tierLabel}) • Status: ${statusText}${tenant ? ` • Tenant: ${tenant.name}` : ''}`}
                            aria-label={`${b.label}, ${tierLabel}, ${statusText}`}
                            className={`h-6 sm:h-6.5 px-1.5 min-w-[2.25rem] rounded-md text-[10px] sm:text-[11px] font-semibold border flex items-center justify-center gap-1 transition-transform group-hover:border-slate-400/80 shadow-2xs select-none ${statusBg}`}
                          >
                            {b.tier === 'upper' && (
                              <span className="text-[8px] sm:text-[9px] opacity-75 font-mono" aria-hidden="true">
                                ↑
                              </span>
                            )}
                            {b.tier === 'lower' && (
                              <span className="text-[8px] sm:text-[9px] opacity-75 font-mono" aria-hidden="true">
                                ↓
                              </span>
                            )}
                            <span className="tracking-tight whitespace-nowrap">{shortCode}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* AREA 3: FOOTER (Sharing type on left, formatted occupancy count on right) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-600 truncate max-w-[120px]">
                    {formatSharingType(room.sharingType)}
                  </span>
                  <span
                    className={`font-semibold shrink-0 text-right ${
                      vacantCount > 0 ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {occupancySummary}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional bottom helper indicator if more rooms exist */}
      {rooms.length > filteredRooms.length && (
        <div className="mt-3 text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedFloorId('all')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Show all {rooms.length} rooms
          </button>
        </div>
      )}
    </div>
  );
};

