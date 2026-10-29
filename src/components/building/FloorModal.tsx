import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Floor } from '../../types';
import { Layers, Plus, Trash2, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FloorModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
}

export const FloorModal: React.FC<FloorModalProps> = ({
  isOpen,
  onClose,
  propertyId,
}) => {
  const { state, addFloor, updateFloor, deleteFloor } = useData();

  const buildingFloors = state.floors.filter((f) => f.propertyId === propertyId);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [floorToEdit, setFloorToEdit] = useState<Floor | null>(null);

  const [floorNumber, setFloorNumber] = useState<number>(buildingFloors.length + 1);
  const [floorName, setFloorName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const startCreate = () => {
    const nextNum = buildingFloors.length + 1;
    setFloorNumber(nextNum);
    setFloorName(`Floor ${nextNum}`);
    setError(null);
    setMode('create');
  };

  const startEdit = (floor: Floor) => {
    setFloorToEdit(floor);
    setFloorNumber(floor.number);
    setFloorName(floor.name);
    setError(null);
    setMode('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!floorName.trim()) {
      setError('Floor name is required.');
      return;
    }

    if (mode === 'create') {
      const res = addFloor({
        propertyId,
        number: floorNumber,
        name: floorName.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to add floor.');
        return;
      }

      setSuccessMsg(`Floor "${floorName.trim()}" added!`);
      setTimeout(() => {
        setSuccessMsg(null);
        setMode('list');
      }, 1000);
    } else if (mode === 'edit' && floorToEdit) {
      const res = updateFloor(floorToEdit.id, {
        number: floorNumber,
        name: floorName.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to update floor.');
        return;
      }

      setSuccessMsg(`Floor updated!`);
      setTimeout(() => {
        setSuccessMsg(null);
        setMode('list');
      }, 1000);
    }
  };

  const handleDelete = (floor: Floor) => {
    if (window.confirm(`Delete "${floor.name}"? Only floors without active tenants can be removed.`)) {
      const res = deleteFloor(floor.id);
      if (!res.success) {
        setError(res.error || 'Cannot delete floor.');
      } else {
        setSuccessMsg(`Floor "${floor.name}" deleted.`);
        setTimeout(() => setSuccessMsg(null), 1500);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'list' ? 'Manage Floors' : mode === 'create' ? 'Add New Floor' : 'Edit Floor'}
      description="Configure and label the floors in this building"
      maxWidth="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'list' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Current Floors ({buildingFloors.length})
              </span>
              <button
                type="button"
                onClick={startCreate}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Floor</span>
              </button>
            </div>

            <div className="space-y-2">
              {buildingFloors.map((floor) => {
                const roomCount = state.rooms.filter((r) => r.floorId === floor.id).length;
                return (
                  <div
                    key={floor.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                        {floor.number}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{floor.name}</h4>
                        <p className="text-[11px] text-slate-500">
                          {roomCount} {roomCount === 1 ? 'room' : 'rooms'} configured
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(floor)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit floor name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(floor)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete floor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Floor #
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  required
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Floor Label / Name *
                </label>
                <input
                  type="text"
                  required
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  placeholder="e.g. Ground Floor, Floor 1, Terrace"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                {mode === 'create' ? 'Add Floor' : 'Save Floor'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

