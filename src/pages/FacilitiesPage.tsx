import React, { useState } from 'react';
import { useData } from '../persistence/DataContext';
import { MaintenanceTicket, BuildingAmenity, MaintenanceCategory, MaintenanceStatus } from '../types';
import { formatINR } from '../utils/currency';
import { formatIndianDate } from '../utils/date';
import { TicketModal } from '../components/facilities/TicketModal';
import { AmenityModal } from '../components/facilities/AmenityModal';
import {
  Wrench,
  Package,
  Plus,
  Wifi,
  Droplets,
  Video,
  Shirt,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react';

export const FacilitiesPage: React.FC = () => {
  const { state, metrics, updateMaintenanceTicket } = useData();

  const [activeTab, setActiveTab] = useState<'maintenance' | 'inventory' | 'amenities'>('maintenance');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<MaintenanceTicket | undefined>(undefined);
  const [amenityToEdit, setAmenityToEdit] = useState<BuildingAmenity | null>(null);

  // Filtered maintenance tickets
  const filteredTickets = state.maintenanceTickets.filter((t) => {
    if (ticketFilter === 'open' && t.status === 'resolved') return false;
    if (ticketFilter === 'resolved' && t.status !== 'resolved') return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    return true;
  });

  const getAmenityIcon = (name: string) => {
    if (name.includes('Wi-Fi')) return Wifi;
    if (name.includes('Water') || name.includes('RO')) return Droplets;
    if (name.includes('CCTV')) return Video;
    if (name.includes('Washing')) return Shirt;
    return UtensilsCrossed;
  };

  const priorityStyles = {
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    medium: 'bg-blue-50 text-blue-700 border-blue-200',
    high: 'bg-amber-50 text-amber-800 border-amber-200',
    urgent: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
  };

  const statusStyles = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
    resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };

  // Compile active room inventory counts
  const allAssignedInventory = state.tenants
    .filter((t) => t.status !== 'checked_out')
    .flatMap((t) => {
      const room = state.rooms.find((r) => r.id === t.roomId);
      const bed = room?.beds.find((b) => b.id === t.bedId);
      return t.assignedInventory.map((item) => ({
        ...item,
        tenantName: t.name,
        roomNumber: room?.roomNumber || '—',
        bedLabel: bed?.label || '—',
      }));
    });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Facilities & Maintenance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage repair tickets, building amenities, and room inventory checklist
          </p>
        </div>

        {activeTab === 'maintenance' && (
          <button
            type="button"
            onClick={() => {
              setTicketToEdit(undefined);
              setShowTicketModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Log Maintenance Ticket</span>
          </button>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'maintenance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Maintenance Tickets ({metrics.openTicketsCount} Open)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('amenities')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'amenities'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wifi className="w-4 h-4" />
          <span>Building Amenities ({state.amenities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Assigned Inventory ({allAssignedInventory.length} Items)</span>
        </button>
      </div>

      {/* TAB 1: MAINTENANCE TICKETS */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'open', label: `Open Tickets (${metrics.openTicketsCount})` },
                { id: 'resolved', label: 'Resolved Tickets' },
                { id: 'all', label: `All Tickets (${state.maintenanceTickets.length})` },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setTicketFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    ticketFilter === tab.id
                      ? 'bg-brand-600 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 capitalize focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="wi-fi">Wi-Fi</option>
                <option value="cleaning">Cleaning</option>
                <option value="appliance">Appliance</option>
              </select>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No tickets found</h3>
              <p className="text-xs text-slate-400 mt-1">
                There are no maintenance tickets matching your active filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTickets.map((ticket) => {
                const floor = state.floors.find((f) => f.id === ticket.floorId);
                const room = state.rooms.find((r) => r.id === ticket.roomId);

                return (
                  <div
                    key={ticket.id}
                    onClick={() => {
                      setTicketToEdit(ticket);
                      setShowTicketModal(true);
                    }}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {ticket.ticketNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                              priorityStyles[ticket.priority]
                            }`}
                          >
                            {ticket.priority} priority
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                            statusStyles[ticket.status]
                          }`}
                        >
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {ticket.title}
                      </h3>

                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 font-medium">
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 capitalize">
                          {ticket.category}
                        </span>
                        <span>
                          {floor?.name} {room ? `• Room ${room.roomNumber}` : '• Common Area'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Estimated Cost</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {formatINR(ticket.estimatedCost)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Logged Date</span>
                        <span className="font-medium text-slate-600">
                          {formatIndianDate(ticket.createdDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUILDING AMENITIES */}
      {activeTab === 'amenities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.amenities.map((amenity) => {
            const Icon = getAmenityIcon(amenity.name);
            const isOperational = amenity.status === 'Operational';

            return (
              <div
                key={amenity.id}
                onClick={() => setAmenityToEdit(amenity)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isOperational
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {amenity.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{amenity.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{amenity.notes || 'Commercial grade property facility.'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Last Service: {formatIndianDate(amenity.lastServiceDate)}</span>
                  <span className="text-brand-600 font-semibold hover:underline">Edit →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: ASSIGNED INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Room Inventory Across Active Tenants</h3>
              <p className="text-xs text-slate-500">
                Mattress, pillow, keys, study table, fan, and geyser condition tracking
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
              {allAssignedInventory.length} Total Monitored Items
            </span>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px] sticky top-0">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Assigned Tenant</th>
                  <th className="py-3 px-4">Room & Bed</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Check-in Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAssignedInventory.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4 text-slate-700">{item.tenantName}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      Room {item.roomNumber}, Bed {item.bedLabel}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.condition === 'Good' || item.condition === 'New'
                            ? 'bg-emerald-50 text-emerald-800'
                            : item.condition === 'Fair'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{formatIndianDate(item.checkInDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showTicketModal && (
        <TicketModal
          isOpen={true}
          onClose={() => {
            setShowTicketModal(false);
            setTicketToEdit(undefined);
          }}
          ticketToEdit={ticketToEdit}
        />
      )}

      {amenityToEdit && (
        <AmenityModal
          isOpen={true}
          onClose={() => setAmenityToEdit(null)}
          amenity={amenityToEdit}
        />
      )}
    </div>
  );
};

