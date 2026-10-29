import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import {
  MaintenanceTicket,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  Expense,
} from '../../types';
import { formatINR } from '../../utils/currency';
import { formatIndianDate } from '../../utils/date';
import { AlertCircle, IndianRupee, CheckCircle2 } from 'lucide-react';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketToEdit?: MaintenanceTicket;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  isOpen,
  onClose,
  ticketToEdit,
}) => {
  const { state, addMaintenanceTicket, updateMaintenanceTicket, convertTicketToExpense } = useData();

  const [title, setTitle] = useState(ticketToEdit?.title || '');
  const [description, setDescription] = useState(ticketToEdit?.description || '');
  const [floorId, setFloorId] = useState(ticketToEdit?.floorId || state.floors[0]?.id || '');
  const [roomId, setRoomId] = useState(ticketToEdit?.roomId || '');
  const [category, setCategory] = useState<MaintenanceCategory>(ticketToEdit?.category || 'plumbing');
  const [priority, setPriority] = useState<MaintenancePriority>(ticketToEdit?.priority || 'medium');
  const [status, setStatus] = useState<MaintenanceStatus>(ticketToEdit?.status || 'pending');
  const [estimatedCost, setEstimatedCost] = useState<number>(ticketToEdit?.estimatedCost || 0);
  const [resolutionNotes, setResolutionNotes] = useState(ticketToEdit?.resolutionNotes || '');

  // Convert to expense sub-flow
  const [showExpenseConvert, setShowExpenseConvert] = useState(false);
  const [actualCost, setActualCost] = useState<number>(ticketToEdit?.estimatedCost || 0);
  const [paymentMode, setPaymentMode] = useState<Expense['paymentMode']>('Cash');
  const [expenseNotes, setExpenseNotes] = useState('');

  const [error, setError] = useState<string | null>(null);

  const filteredRooms = state.rooms.filter((r) => r.floorId === floorId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Ticket title is required.');
      return;
    }

    if (ticketToEdit) {
      updateMaintenanceTicket(ticketToEdit.id, {
        title: title.trim(),
        description: description.trim(),
        floorId,
        roomId: roomId || undefined,
        category,
        priority,
        status,
        estimatedCost,
        resolutionNotes: resolutionNotes.trim() || undefined,
        resolvedDate: status === 'resolved' ? state.demoDate : undefined,
      });
      onClose();
    } else {
      addMaintenanceTicket({
        title: title.trim(),
        description: description.trim(),
        floorId,
        roomId: roomId || undefined,
        category,
        priority,
        status,
        createdDate: state.demoDate,
        estimatedCost,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });
      onClose();
    }
  };

  const handleConvertToExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToEdit) return;

    if (actualCost <= 0) {
      setError('Actual expense amount must be greater than ₹0.');
      return;
    }

    const res = convertTicketToExpense(ticketToEdit.id, actualCost, paymentMode, expenseNotes);
    if (!res.success) {
      setError(res.error || 'Failed to convert to expense.');
    } else {
      setShowExpenseConvert(false);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ticketToEdit ? `Ticket: ${ticketToEdit.ticketNumber}` : 'Log Maintenance Ticket'}
      description="Track property repairs, technician visits and costs"
      maxWidth="md"
    >
      {!showExpenseConvert ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Issue Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Geyser switch sparking"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none capitalize"
              >
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="wi-fi">Wi-Fi</option>
                <option value="cleaning">Cleaning</option>
                <option value="appliance">Appliance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none capitalize"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Floor *
              </label>
              <select
                value={floorId}
                onChange={(e) => {
                  setFloorId(e.target.value);
                  setRoomId('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {state.floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Room (Optional)
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">-- Common Area / Corridor --</option>
                {filteredRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Issue Description
            </label>
            <textarea
              rows={2}
              placeholder="Describe the problem, technician inspection, or parts needed"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Estimated Cost (INR)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ticket Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold capitalize"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {ticketToEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Resolution Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Electrician replaced 16A socket and tested"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          )}

          {/* Explicit Expense Conversion Action (Section 13) */}
          {ticketToEdit && !ticketToEdit.linkedExpenseId && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Record Actual Expense</span>
                <span className="text-[11px] text-slate-500">
                  Estimated costs are not auto-converted. Click to post actual expense to Cash Flow.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseConvert(true)}
                className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold whitespace-nowrap"
              >
                Log as Expense →
              </button>
            </div>
          )}

          {ticketToEdit?.linkedExpenseId && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Actual expense already posted to Cash Flow ledger.</span>
            </div>
          )}

          {/* Footer buttons */}
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
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              {ticketToEdit ? 'Save Ticket' : 'Create Ticket'}
            </button>
          </div>
        </form>
      ) : (
        /* Convert to Expense Form */
        <form onSubmit={handleConvertToExpense} className="space-y-4">
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-900">
            <strong>Posting Actual Expense:</strong> This will create a verified maintenance outflow in your Expenses & Cash Flow ledger and mark this ticket as resolved.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Actual Amount Paid (INR) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <IndianRupee className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="1"
                step="50"
                value={actualCost}
                onChange={(e) => setActualCost(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Mode *
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Expense Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid plumber for replacement parts and labor"
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowExpenseConvert(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Ticket
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Record & Resolve Ticket
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

