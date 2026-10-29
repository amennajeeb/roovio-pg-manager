import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Property } from '../../types';
import {
  Building2,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface BuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingToEdit?: Property;
}

export const BuildingModal: React.FC<BuildingModalProps> = ({
  isOpen,
  onClose,
  buildingToEdit,
}) => {
  const { properties, activePropertyId, setActiveBuilding, addBuilding, updateBuilding, archiveBuilding } = useData();

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>(buildingToEdit ? 'edit' : 'list');
  const [selectedPropToEdit, setSelectedPropToEdit] = useState<Property | null>(buildingToEdit || null);

  // Form states
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Kozhikode, Kerala');
  const [pincode, setPincode] = useState('673004');
  const [phone, setPhone] = useState('+91 98450 12345');
  const [upiId, setUpiId] = useState('');
  const [totalFloors, setTotalFloors] = useState<number>(3);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const startCreate = () => {
    setName('');
    setTagline('');
    setDescription('');
    setAddress('');
    setCity('Kozhikode, Kerala');
    setPincode('673004');
    setPhone('+91 98450 12345');
    setUpiId('myproperty@upi');
    setTotalFloors(3);
    setError(null);
    setMode('create');
  };

  const startEdit = (prop: Property) => {
    setSelectedPropToEdit(prop);
    setName(prop.name);
    setTagline(prop.tagline || '');
    setDescription(prop.description || '');
    setAddress(prop.address);
    setCity(prop.city);
    setPincode(prop.pincode);
    setPhone(prop.phone);
    setUpiId(prop.upiId);
    setTotalFloors(prop.totalFloors || 2);
    setError(null);
    setMode('edit');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Building name is required.');
      return;
    }

    if (mode === 'create') {
      const res = addBuilding({
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        phone: phone.trim(),
        upiId: upiId.trim(),
        totalFloors,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create building.');
        return;
      }

      setSuccessMsg(`Building "${name.trim()}" created successfully with ${totalFloors} floors!`);
      setTimeout(() => {
        setSuccessMsg(null);
        setMode('list');
      }, 1500);
    } else if (mode === 'edit' && selectedPropToEdit) {
      const res = updateBuilding(selectedPropToEdit.id, {
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        phone: phone.trim(),
        upiId: upiId.trim(),
        totalFloors,
      });

      if (!res.success) {
        setError(res.error || 'Failed to update building.');
        return;
      }

      setSuccessMsg(`Building "${name.trim()}" updated successfully.`);
      setTimeout(() => {
        setSuccessMsg(null);
        setMode('list');
      }, 1200);
    }
  };

  const handleToggleArchive = (prop: Property) => {
    const nextState = !prop.isArchived;
    const confirmMsg = nextState
      ? `Archive "${prop.name}"? Historical records, tenants, and payment history will be preserved.`
      : `Restore "${prop.name}" as an active building?`;

    if (window.confirm(confirmMsg)) {
      archiveBuilding(prop.id, nextState);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'list'
          ? 'Manage Buildings & Hostels'
          : mode === 'create'
          ? 'Add New Building / Hostel'
          : 'Edit Building Details'
      }
      description="Create, configure and manage multiple hostel and PG buildings for your account"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Messages */}
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

        {/* VIEW 1: BUILDING LIST */}
        {mode === 'list' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Your Buildings ({properties.length})
              </span>
              <button
                type="button"
                onClick={startCreate}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Building</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {properties.map((prop) => {
                const isActive = prop.id === activePropertyId;
                return (
                  <div
                    key={prop.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'border-brand-500 bg-brand-50/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {prop.name}
                          </h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800">
                              Active
                            </span>
                          )}
                          {prop.isArchived && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                              Archived
                            </span>
                          )}
                        </div>

                        {prop.description && (
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                            {prop.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {prop.city}
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {prop.totalFloors || 1} Floors
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {prop.phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isActive && !prop.isArchived && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveBuilding(prop.id);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
                          >
                            Open
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(prop)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit building"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {properties.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(prop)}
                            className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title={prop.isArchived ? 'Restore building' : 'Archive building'}
                          >
                            {prop.isArchived ? (
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: CREATE / EDIT FORM */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Building Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kannur City Ladies Hostel or Kozhikode Urban PG"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tagline (Optional)
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Student Residency near Brennan College"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Total Floors *
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description / Highlights (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Safe accommodation with 24x7 security, high-speed Wi-Fi and 3 times food"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 124, 4th Cross, Cyber Valley"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  City & State *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Kozhikode, Kerala or Kannur, Kerala"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PIN Code *
                </label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="560100"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Phone *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 12345"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official UPI ID *
                </label>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="malabarpg@upi"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                ← Back to List
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                {mode === 'create' ? 'Create Building' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

