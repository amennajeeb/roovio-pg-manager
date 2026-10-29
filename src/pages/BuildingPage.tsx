import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../persistence/DataContext';
import { Room, Bed, Tenant } from '../types';
import { BedStatusBadge } from '../components/common/Badge';
import { RoomModal } from '../components/building/RoomModal';
import { BulkRoomModal } from '../components/building/BulkRoomModal';
import { FloorModal } from '../components/building/FloorModal';
import { BuildingModal } from '../components/building/BuildingModal';
import { BedDetailsModal } from '../components/building/BedDetailsModal';
import { RoomDetailsModal } from '../components/building/RoomDetailsModal';
import { SafeRoomDeleteModal } from '../components/building/SafeRoomDeleteModal';
import { OnboardingModal } from '../components/tenants/OnboardingModal';
import { TenantDrawer } from '../components/tenants/TenantDrawer';
import { formatINR } from '../utils/currency';
import {
  Building2,
  Plus,
  Search,
  Wind,
  Bath,
  Sun,
  Edit2,
  Layers,
  Bed as BedIcon,
  HelpCircle,
  Zap,
  SlidersHorizontal,
  Utensils,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Tv,
  Flame,
  Phone,
  MapPin,
  ChevronDown,
  MoreVertical,
  Eye,
  Archive,
  Package,
  DoorClosed,
  ArrowRightLeft,
  RotateCcw,
  Wrench,
} from 'lucide-react';

export const BuildingPage: React.FC = () => {
  const {
    state,
    properties,
    activePropertyId,
    setActiveBuilding,
    getBuildingMetrics,
    reopenRoom,
  } = useData();
  const [searchParams] = useSearchParams();

  // Modals state
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | undefined>(undefined);
  const [selectedBedInfo, setSelectedBedInfo] = useState<{ bed: Bed; room: Room } | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [preselectedBedInfo, setPreselectedBedInfo] = useState<{ roomId: string; bedId: string } | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Room lifecycle & inspection modals
  const [selectedRoomForDetails, setSelectedRoomForDetails] = useState<Room | null>(null);
  const [selectedRoomForLifecycle, setSelectedRoomForLifecycle] = useState<Room | null>(null);
  const [openDropdownRoomId, setOpenDropdownRoomId] = useState<string | null>(null);

  // Filters from URL or state
  const initialFilter = searchParams.get('filter') || 'all';
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('all');
  const [sharingFilter, setSharingFilter] = useState<string>('all');
  const [acFilter, setAcFilter] = useState<string>('all');
  const [bathroomFilter, setBathroomFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Building info & metrics
  const activeBuilding = properties.find((p) => p.id === activePropertyId) || state.property;
  const metrics = useMemo(
    () => getBuildingMetrics(activeBuilding.id),
    [getBuildingMetrics, activeBuilding.id, state.rooms, state.tenants]
  );

  // Floors for this active building
  const activeFloors = useMemo(() => {
    return state.floors.filter((f) => f.propertyId === activeBuilding.id);
  }, [state.floors, activeBuilding.id]);

  // Rooms for this active building
  const activeRooms = useMemo(() => {
    return state.rooms.filter((r) => r.propertyId === activeBuilding.id);
  }, [state.rooms, activeBuilding.id]);

  // Filtered rooms logic
  const filteredRooms = useMemo(() => {
    return activeRooms.filter((room) => {
      // Floor filter
      if (selectedFloorId !== 'all' && room.floorId !== selectedFloorId) return false;

      // Purpose / Lifecycle filter
      if (purposeFilter !== 'all') {
        if (purposeFilter === 'accommodation') {
          if (room.roomPurpose && room.roomPurpose !== 'accommodation') return false;
          if (room.operationalStatus && room.operationalStatus !== 'available') return false;
        } else if (purposeFilter === 'storage') {
          if (room.roomPurpose !== 'storage' && room.operationalStatus !== 'storage' && room.status !== 'storage')
            return false;
        } else if (purposeFilter === 'maintenance') {
          if (room.roomPurpose !== 'maintenance' && room.operationalStatus !== 'maintenance' && room.status !== 'maintenance')
            return false;
        } else if (purposeFilter === 'closed') {
          if (room.operationalStatus !== 'closed' && room.status !== 'closed') return false;
        } else if (purposeFilter === 'retired') {
          if (room.operationalStatus !== 'retired' && room.status !== 'retired') return false;
        }
      }

      // Sharing / Bed type filter
      if (sharingFilter !== 'all') {
        if (sharingFilter === 'single' && !room.beds.some((b) => b.bedType === 'single')) return false;
        if (sharingFilter === 'bunk' && !room.beds.some((b) => b.bedType === 'bunk')) return false;
      }

      // AC filter
      if (acFilter === 'ac' && !room.hasAc) return false;
      if (acFilter === 'non-ac' && room.hasAc) return false;

      // Bathroom filter
      if (bathroomFilter !== 'all') {
        if (bathroomFilter === 'attached' && room.bathroomType !== 'attached') return false;
        if (bathroomFilter === 'shared' && room.bathroomType !== 'shared') return false;
      }

      // Room search
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesRoomNumber = room.roomNumber.toLowerCase().includes(query);
        const hasTenantMatch = room.beds.some((b) => {
          if (!b.currentTenantId) return false;
          const tenant = state.tenants.find((t) => t.id === b.currentTenantId);
          return tenant?.name.toLowerCase().includes(query);
        });
        const hasBerthMatch = room.beds.some(
          (b) => b.id.toLowerCase().includes(query) || b.label.toLowerCase().includes(query)
        );

        if (!matchesRoomNumber && !hasTenantMatch && !hasBerthMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const hasMatchingBed = room.beds.some((b) => b.status === statusFilter);
        if (!hasMatchingBed) return false;
      }

      return true;
    });
  }, [
    activeRooms,
    state.tenants,
    selectedFloorId,
    purposeFilter,
    sharingFilter,
    acFilter,
    bathroomFilter,
    searchQuery,
    statusFilter,
  ]);

  // Bed Click Interaction
  const handleBedClick = (bed: Bed, room: Room) => {
    // If room is closed, storage, or retired, prevent new onboarding allocations
    const isOffService =
      room.operationalStatus === 'closed' ||
      room.operationalStatus === 'storage' ||
      room.operationalStatus === 'retired' ||
      room.roomPurpose === 'storage';

    if (bed.status === 'vacant') {
      if (isOffService) {
        setSelectedRoomForDetails(room);
        return;
      }
      setPreselectedBedInfo({ roomId: room.id, bedId: bed.id });
      setShowOnboardModal(true);
    } else if (bed.status === 'occupied' || bed.status === 'notice') {
      if (bed.currentTenantId) {
        setSelectedTenantId(bed.currentTenantId);
      }
    } else if (bed.status === 'maintenance') {
      setSelectedBedInfo({ bed, room });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Multi-Building Switcher & Management Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                Active Building
              </span>
              {activeBuilding.isArchived && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  Archived
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {activeBuilding.name}
              </h2>

              {/* Building selector dropdown if multiple */}
              {properties.length > 1 && (
                <div className="relative">
                  <select
                    value={activeBuilding.id}
                    onChange={(e) => setActiveBuilding(e.target.value)}
                    className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
                    aria-label="Switch active building"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isArchived ? '(Archived)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
              {activeBuilding.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {activeBuilding.address}, {activeBuilding.city}
                </span>
              )}
              {activeBuilding.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {activeBuilding.phone}
                </span>
              )}
              {activeBuilding.description && (
                <span className="text-slate-400 italic">
                  "{activeBuilding.description}"
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setShowBuildingModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>Buildings ({properties.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFloorModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Floors ({activeFloors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">Bulk Generate</span>
              <span className="sm:hidden">Bulk</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRoomToEdit(undefined);
                setShowRoomModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Concise Building KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Total Rooms */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Rooms
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900">{metrics.totalRooms}</span>
            <span className="text-xs text-slate-500">physical rooms</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {metrics.accommodationRooms} Accommodation
            {(metrics.storageRooms > 0 || metrics.closedRooms > 0 || metrics.retiredRooms > 0) && (
              <span className="text-amber-700 font-medium">
                {' '}• {metrics.storageRooms + metrics.closedRooms + metrics.retiredRooms} off-service
              </span>
            )}
          </div>
        </div>

        {/* 2. Total Capacity */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Available Capacity
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900">{metrics.totalBerths}</span>
            <span className="text-xs text-slate-500">berths</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Excludes storage & retired rooms
          </div>
        </div>

        {/* 3. Occupied Berths */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
            Occupied Berths
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-brand-800">{metrics.occupiedBerths}</span>
            <span className="text-xs font-semibold text-brand-700 font-mono">
              {metrics.occupancyRate.toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Active resident contracts
          </div>
        </div>

        {/* 4. Vacant Berths */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Vacant Berths
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-800">{metrics.vacantBerths}</span>
            <span className="text-xs font-semibold text-emerald-700 font-mono">
              {metrics.totalBerths > 0
                ? ((metrics.vacantBerths / metrics.totalBerths) * 100).toFixed(0)
                : 0}
              %
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
            Ready to allocate
          </div>
        </div>
      </div>

      {/* Visible Status Legend with Text Labels */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Berth Status Legend:
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="font-semibold text-slate-700">Vacant Berth</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              <span className="font-semibold text-slate-700">Occupied Berth</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="font-semibold text-slate-700">Notice Period</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="font-semibold text-slate-700">Maintenance</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Floor Tabs & Floor Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedFloorId('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            selectedFloorId === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Floors ({activeRooms.length} Rooms • {metrics.totalBerths} Berths)
        </button>

        {activeFloors.map((floor) => {
          const roomsOnFloor = activeRooms.filter((r) => r.floorId === floor.id);
          const count = roomsOnFloor.length;
          const berthsCount = roomsOnFloor.reduce((sum, r) => sum + r.beds.length, 0);

          return (
            <button
              type="button"
              key={floor.id}
              onClick={() => setSelectedFloorId(floor.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                selectedFloorId === floor.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {floor.name} ({count} Rooms • {berthsCount} Berths)
            </button>
          );
        })}
      </div>

      {/* 4. Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search room, berth, or tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
              aria-label="Filter by room purpose"
            >
              <option value="all">All Room Types</option>
              <option value="accommodation">Accommodation Only</option>
              <option value="storage">Storage Rooms</option>
              <option value="maintenance">Maintenance Rooms</option>
              <option value="closed">Closed Rooms</option>
              <option value="retired">Retired Rooms</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
              aria-label="Filter by berth status"
            >
              <option value="all">All Berth Statuses</option>
              <option value="vacant">Vacant Berths Only</option>
              <option value="occupied">Occupied Berths</option>
              <option value="notice">Notice Period</option>
              <option value="maintenance">Under Maintenance</option>
            </select>

            <select
              value={sharingFilter}
              onChange={(e) => setSharingFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
              aria-label="Filter by bed type"
            >
              <option value="all">All Bed Types</option>
              <option value="bunk">Rooms with Bunk Beds</option>
              <option value="single">Rooms with Single Beds</option>
            </select>

            <select
              value={acFilter}
              onChange={(e) => setAcFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
              aria-label="Filter by AC"
            >
              <option value="all">AC & Non-AC</option>
              <option value="ac">AC Rooms Only</option>
              <option value="non-ac">Non-AC Only</option>
            </select>

            <select
              value={bathroomFilter}
              onChange={(e) => setBathroomFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
              aria-label="Filter by bathroom"
            >
              <option value="all">All Bathrooms</option>
              <option value="attached">Attached Bathroom</option>
              <option value="shared">Shared Bathroom</option>
            </select>

            {(statusFilter !== 'all' ||
              purposeFilter !== 'all' ||
              sharingFilter !== 'all' ||
              acFilter !== 'all' ||
              bathroomFilter !== 'all' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setPurposeFilter('all');
                  setSharingFilter('all');
                  setAcFilter('all');
                  setBathroomFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-rose-600 font-semibold hover:underline shrink-0 px-2"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Responsive Room Grid */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No rooms found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria, floor selection, or room filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const floor = activeFloors.find((f) => f.id === room.floorId);
            const vacantBedsCount = room.beds.filter((b) => b.status === 'vacant').length;
            const occupiedBedsCount = room.beds.filter((b) => b.status === 'occupied' || b.status === 'notice').length;

            const isStorage = room.roomPurpose === 'storage' || room.operationalStatus === 'storage' || room.status === 'storage';
            const isClosed = room.operationalStatus === 'closed' || room.status === 'closed';
            const isRetired = room.operationalStatus === 'retired' || room.status === 'retired';
            const isMaintenance = room.operationalStatus === 'maintenance' || room.status === 'maintenance';

            // Group beds by Bunk vs Single
            const bunkGroups: Record<string, Bed[]> = {};
            const singleBeds: Bed[] = [];

            room.beds.forEach((bed) => {
              if (bed.bedType === 'bunk' && bed.bunkGroup) {
                if (!bunkGroups[bed.bunkGroup]) {
                  bunkGroups[bed.bunkGroup] = [];
                }
                bunkGroups[bed.bunkGroup].push(bed);
              } else {
                singleBeds.push(bed);
              }
            });

            return (
              <div
                key={room.id}
                className={`bg-white rounded-xl border p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between relative ${
                  isRetired
                    ? 'border-slate-300 opacity-75 bg-slate-50/50'
                    : isClosed
                    ? 'border-rose-200'
                    : isStorage
                    ? 'border-amber-200'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Room Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900">
                          Room {room.roomNumber}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {floor?.name || 'Floor'}
                        </span>

                        {/* Operational & Purpose Badges */}
                        {isStorage && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                            <Package className="w-3 h-3" /> Storage
                          </span>
                        )}
                        {isClosed && (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                            <DoorClosed className="w-3 h-3" /> Closed
                          </span>
                        )}
                        {isRetired && (
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1">
                            <Archive className="w-3 h-3" /> Retired
                          </span>
                        )}
                        {isMaintenance && !isClosed && (
                          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> Maintenance
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{room.sharingType}</span>
                        {!isStorage && !isClosed && !isRetired && (
                          <>
                            <span>•</span>
                            <span>{room.beds.length} Berths</span>
                          </>
                        )}
                        {room.roomRent && room.roomRent > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono font-semibold text-slate-700">
                              {formatINR(room.roomRent)}/mo
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Icons & Dropdown */}
                    <div className="flex items-center gap-1 relative">
                      {/* View Details Quick Action */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoomForDetails(room)}
                        aria-label={`View details of Room ${room.roomNumber}`}
                        title="Room Overview & History"
                        className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Quick Action */}
                      <button
                        type="button"
                        onClick={() => {
                          setRoomToEdit(room);
                          setShowRoomModal(true);
                        }}
                        aria-label={`Edit Room ${room.roomNumber}`}
                        title="Edit Room & Facilities"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDropdownRoomId(openDropdownRoomId === room.id ? null : room.id)
                        }
                        aria-label="More actions"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Floating Dropdown Menu */}
                      {openDropdownRoomId === room.id && (
                        <div
                          className="absolute right-0 top-8 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs text-slate-700 divide-y divide-slate-100"
                          onMouseLeave={() => setOpenDropdownRoomId(null)}
                        >
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownRoomId(null);
                                setSelectedRoomForDetails(room);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View Overview & History</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownRoomId(null);
                                setRoomToEdit(room);
                                setShowRoomModal(true);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Edit Room & Facilities</span>
                            </button>
                          </div>

                          <div className="py-1">
                            {isStorage || isClosed || isRetired ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownRoomId(null);
                                  reopenRoom(room.id);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-2"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Reopen for Residents</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownRoomId(null);
                                  setSelectedRoomForLifecycle(room);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                                <span>Transfer Residents ({occupiedBedsCount})</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownRoomId(null);
                                setSelectedRoomForLifecycle(room);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-700 flex items-center gap-2"
                            >
                              <Archive className="w-3.5 h-3.5 text-rose-500" />
                              <span>Lifecycle & Safe Delete...</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Concise Amenities Summary */}
                  {(() => {
                    const am = room.amenities || room.amenitiesList;
                    const items: string[] = [];
                    if (room.hasAc) items.push('AC');
                    else items.push('Non-AC');
                    items.push(room.bathroomType === 'attached' || room.hasAttachedBathroom ? 'Attached Bath' : 'Shared Bath');
                    if (am?.wifi) items.push('Wi-Fi');
                    if (am?.geyser) items.push('Geyser');
                    if (am?.cupboard) items.push('Cupboard');
                    if (am?.table || am?.studyTable) items.push('Desk');
                    if (am?.tv) items.push('TV');
                    if (room.hasBalcony) items.push('Balcony');

                    return (
                      <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-400">Amenities:</span>
                        <span>{items.join(' • ')}</span>
                      </div>
                    );
                  })()}

                  {/* Off-Service Informational Banner */}
                  {(isStorage || isClosed || isRetired) ? (
                    <div className="mt-3.5 p-3 rounded-xl border bg-slate-50 space-y-2">
                      <div className="flex items-start gap-2">
                        {isStorage && <Package className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                        {isClosed && <DoorClosed className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                        {isRetired && <Archive className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800">
                            {isStorage
                              ? 'Converted to Storage Room'
                              : isClosed
                              ? 'Temporarily Closed Room'
                              : 'Retired from Service'}
                          </p>
                          {room.statusReason && (
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Reason: {room.statusReason}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            Berths in this room are excluded from property accommodation capacity.
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {room.beds.length} sleeping berth(s) reserved
                        </span>
                        <button
                          type="button"
                          onClick={() => reopenRoom(room.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reopen Room</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* VISUAL BED LAYOUTS FOR ACTIVE ROOMS */
                    <div className="mt-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                          Sleeping Berths ({room.beds.length})
                        </span>
                        <span
                          className={
                            vacantBedsCount > 0
                              ? 'text-emerald-700 font-bold text-xs'
                              : 'text-slate-400 text-xs'
                          }
                        >
                          {vacantBedsCount} Vacant
                        </span>
                      </div>

                      {/* Render Bunk Bed Frames */}
                      {Object.entries(bunkGroups).map(([groupName, berths]) => {
                        const upperBerth = berths.find((b) => b.tier === 'upper') || berths[0];
                        const lowerBerth = berths.find((b) => b.tier === 'lower') || berths[1];

                        return (
                          <div
                            key={groupName}
                            className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold px-0.5">
                              <span className="flex items-center gap-1.5 text-slate-800">
                                <Layers className="w-3.5 h-3.5 text-brand-600" />
                                {groupName} (Bunk Frame)
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Upper & Lower Tiers
                              </span>
                            </div>

                            {upperBerth && (
                              <BerthButton
                                berth={upperBerth}
                                room={room}
                                tenants={state.tenants}
                                onClick={() => handleBedClick(upperBerth, room)}
                                isUpper={true}
                              />
                            )}

                            {lowerBerth && (
                              <BerthButton
                                berth={lowerBerth}
                                room={room}
                                tenants={state.tenants}
                                onClick={() => handleBedClick(lowerBerth, room)}
                                isUpper={false}
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Render Standalone Single Beds */}
                      {singleBeds.map((singleBed) => (
                        <div
                          key={singleBed.id}
                          className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 space-y-1.5"
                        >
                          <BerthButton
                            berth={singleBed}
                            room={room}
                            tenants={state.tenants}
                            onClick={() => handleBedClick(singleBed, room)}
                            isUpper={false}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Capacity: {room.beds.length} berths</span>
                  <span className="font-medium text-slate-500">
                    {room.hasAc ? 'AC' : 'Non-AC'} •{' '}
                    {room.bathroomType === 'attached' || room.hasAttachedBathroom
                      ? 'Attached Bath'
                      : 'Shared Bath'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showBuildingModal && (
        <BuildingModal isOpen={true} onClose={() => setShowBuildingModal(false)} />
      )}

      {showFloorModal && (
        <FloorModal
          isOpen={true}
          onClose={() => setShowFloorModal(false)}
          propertyId={activeBuilding.id}
        />
      )}

      {showBulkModal && (
        <BulkRoomModal
          isOpen={true}
          onClose={() => setShowBulkModal(false)}
          propertyId={activeBuilding.id}
          floorId={selectedFloorId !== 'all' ? selectedFloorId : activeFloors[0]?.id || ''}
        />
      )}

      {showRoomModal && (
        <RoomModal
          isOpen={true}
          onClose={() => {
            setShowRoomModal(false);
            setRoomToEdit(undefined);
          }}
          roomToEdit={roomToEdit}
        />
      )}

      {/* Room Details Modal */}
      {selectedRoomForDetails && (
        <RoomDetailsModal
          isOpen={true}
          onClose={() => setSelectedRoomForDetails(null)}
          room={selectedRoomForDetails}
          onOpenEdit={() => {
            setRoomToEdit(selectedRoomForDetails);
            setSelectedRoomForDetails(null);
            setShowRoomModal(true);
          }}
          onOpenLifecycle={() => {
            setSelectedRoomForLifecycle(selectedRoomForDetails);
            setSelectedRoomForDetails(null);
          }}
        />
      )}

      {/* Safe Room Delete / Lifecycle Modal */}
      {selectedRoomForLifecycle && (
        <SafeRoomDeleteModal
          isOpen={true}
          onClose={() => setSelectedRoomForLifecycle(null)}
          room={selectedRoomForLifecycle}
          onRoomDeletedOrRetired={() => {
            setSelectedRoomForLifecycle(null);
          }}
        />
      )}

      {selectedBedInfo && (
        <BedDetailsModal
          isOpen={true}
          onClose={() => setSelectedBedInfo(null)}
          bed={selectedBedInfo.bed}
          room={selectedBedInfo.room}
        />
      )}

      {showOnboardModal && preselectedBedInfo && (
        <OnboardingModal
          isOpen={true}
          onClose={() => {
            setShowOnboardModal(false);
            setPreselectedBedInfo(null);
          }}
          preselectedRoomId={preselectedBedInfo.roomId}
          preselectedBedId={preselectedBedInfo.bedId}
          onSuccess={(tId) => setSelectedTenantId(tId)}
        />
      )}

      {selectedTenantId && (
        <TenantDrawer
          isOpen={true}
          onClose={() => setSelectedTenantId(null)}
          tenantId={selectedTenantId}
        />
      )}
    </div>
  );
};

// Sub-component for individual berth in visual bed layout
interface BerthButtonProps {
  berth: Bed;
  room: Room;
  tenants: any[];
  onClick: () => void;
  isUpper: boolean;
}

const BerthButton: React.FC<BerthButtonProps> = ({ berth, room, tenants, onClick, isUpper }) => {
  const tenant = berth.currentTenantId
    ? tenants.find((t) => t.id === berth.currentTenantId)
    : null;

  const statusLabels = {
    vacant: 'Vacant',
    occupied: 'Occupied',
    notice: 'Notice Given',
    maintenance: 'Maintenance',
  };

  const label = berth.bedType === 'bunk' ? (isUpper ? 'Upper Berth' : 'Lower Berth') : berth.label;

  return (
    <div
      className={`w-full p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
        berth.status === 'vacant'
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : berth.status === 'occupied'
          ? 'bg-slate-50 border-slate-200 text-slate-900'
          : berth.status === 'notice'
          ? 'bg-amber-50 border-amber-200 text-amber-950'
          : 'bg-rose-50 border-rose-200 text-rose-950'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-xs text-slate-900 truncate">{label}</span>
          <span className="font-mono text-xs font-bold text-slate-800">
            {formatINR(berth.monthlyRent)}/mo
          </span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
              berth.status === 'vacant'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : berth.status === 'occupied'
                ? 'bg-brand-50 text-brand-800 border-brand-200'
                : berth.status === 'notice'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {statusLabels[berth.status]}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 truncate mt-0.5">
          {tenant ? (
            <span className="font-medium text-slate-800">{tenant.name}</span>
          ) : berth.status === 'vacant' ? (
            <span className="text-emerald-700">Available for resident</span>
          ) : (
            <span className="italic">{berth.maintenanceReason || 'Under maintenance'}</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        {berth.status === 'vacant' ? (
          <button
            type="button"
            onClick={onClick}
            className="px-2.5 py-1 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-md shadow-2xs transition-colors"
          >
            Allocate
          </button>
        ) : (
          <button
            type="button"
            onClick={onClick}
            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md border border-slate-200 transition-colors"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
};
