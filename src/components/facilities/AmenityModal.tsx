import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { BuildingAmenity } from '../../types';

interface AmenityModalProps {
  isOpen: boolean;
  onClose: () => void;
  amenity: BuildingAmenity;
}

export const AmenityModal: React.FC<AmenityModalProps> = ({ isOpen, onClose, amenity }) => {
  const { updateAmenity } = useData();

  const [status, setStatus] = useState<BuildingAmenity['status']>(amenity.status);
  const [lastServiceDate, setLastServiceDate] = useState(amenity.lastServiceDate);
  const [nextServiceDate, setNextServiceDate] = useState(amenity.nextServiceDate || '');
  const [notes, setNotes] = useState(amenity.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAmenity(amenity.id, {
      status,
      lastServiceDate,
      nextServiceDate: nextServiceDate || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={amenity.name}
      description="Update operational status and maintenance schedule"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Operational Status *
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold"
          >
            <option value="Operational">Operational</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Scheduled Service">Scheduled Service</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Last Service Date
            </label>
            <input
              type="date"
              value={lastServiceDate}
              onChange={(e) => setLastServiceDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Next Service Date
            </label>
            <input
              type="date"
              value={nextServiceDate}
              onChange={(e) => setNextServiceDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Service Notes / Vendor Details
          </label>
          <input
            type="text"
            placeholder="e.g. Filters replaced, warranty until 2027"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
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
            Save Status
          </button>
        </div>
      </form>
    </Modal>
  );
};

