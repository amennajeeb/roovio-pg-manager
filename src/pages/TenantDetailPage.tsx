import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '../persistence/DataContext';
import { formatINR } from '../utils/currency';
import { formatIndianDate, formatBillingMonth } from '../utils/date';
import { BedStatusBadge, RentStatusBadge } from '../components/common/Badge';
import { TenantDocumentsSection } from '../components/tenants/TenantDocumentsSection';
import { PaymentModal } from '../components/tenants/PaymentModal';
import { WhatsAppPreviewModal } from '../components/tenants/WhatsAppPreviewModal';
import { TenantMoveModal } from '../components/tenants/TenantMoveModal';
import { NoticeCheckoutModal } from '../components/tenants/NoticeCheckoutModal';
import { ReceiptModal } from '../components/tenants/ReceiptModal';
import { Modal } from '../components/common/Modal';
import { PaymentRecord, PermanentAddress } from '../types';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Home,
  Briefcase,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  MessageCircle,
  ArrowRightLeft,
  CalendarCheck,
  DoorOpen,
  Edit2,
  Clock,
  Package,
  Receipt,
  Layers,
  MapPin,
  Calendar,
  Building2,
  Check,
  X,
  Tag,
  Utensils,
  History,
} from 'lucide-react';

export const TenantDetailPage: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { state, updateTenant, updateTenantPricing } = useData();

  // Action Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [viewingReceiptPayment, setViewingReceiptPayment] = useState<PaymentRecord | null>(null);

  // Price Change Modal state
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [newRentInput, setNewRentInput] = useState(0);
  const [newFoodInput, setNewFoodInput] = useState(0);
  const [priceChangeDate, setPriceChangeDate] = useState(state.demoDate);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [priceChangeError, setPriceChangeError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHouse, setEditHouse] = useState('');
  const [editLocality, setEditLocality] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');
  const [editEmployer, setEditEmployer] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editWorkplace, setEditWorkplace] = useState('');
  const [editEmploymentPhone, setEditEmploymentPhone] = useState('');
  const [editMonthlyRent, setEditMonthlyRent] = useState(0);
  const [editDueDay, setEditDueDay] = useState(5);
  const [editMoveInDate, setEditMoveInDate] = useState('');

  const tenant = state.tenants.find((t) => t.id === tenantId);

  if (!tenant) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 max-w-lg mx-auto mt-8">
        <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800">Tenant Not Found</h3>
        <p className="text-xs text-slate-400 mt-1">The requested tenant record does not exist or has been removed.</p>
        <button
          type="button"
          onClick={() => navigate('/tenants')}
          className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold"
        >
          Back to Tenants List
        </button>
      </div>
    );
  }

  const room = state.rooms.find((r) => r.id === tenant.roomId);
  const bed = room?.beds.find((b) => b.id === tenant.bedId);

  // Rent calculations for current month
  const monthCharge = state.rentCharges.find(
    (c) => c.tenantId === tenant.id && c.billingMonth === state.selectedMonth
  );
  const monthPayments = state.payments.filter(
    (p) => p.tenantId === tenant.id && p.billingMonth === state.selectedMonth
  );
  const paidThisMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);
  const balanceRemaining = monthCharge ? Math.max(0, monthCharge.amount - paidThisMonth) : 0;
  const isOverdue = monthCharge ? state.demoDate > monthCharge.dueDate && balanceRemaining > 0 : false;
  const isDueSoon = monthCharge ? state.demoDate <= monthCharge.dueDate && balanceRemaining > 0 : false;

  let rentStatus: 'paid' | 'overdue' | 'due_soon' | 'partially_paid' = 'due_soon';
  if (balanceRemaining <= 0) {
    rentStatus = 'paid';
  } else if (isOverdue) {
    rentStatus = 'overdue';
  } else if (paidThisMonth > 0) {
    rentStatus = 'partially_paid';
  }

  const allTenantCharges = state.rentCharges.filter((c) => c.tenantId === tenant.id);
  const allTenantPayments = state.payments.filter((p) => p.tenantId === tenant.id);

  const openPriceChange = () => {
    if (!tenant) return;
    setNewRentInput(tenant.monthlyRent);
    setNewFoodInput(tenant.agreedFoodCharge || 0);
    setPriceChangeDate(state.demoDate);
    setPriceChangeReason('');
    setPriceChangeError(null);
    setShowPriceModal(true);
  };

  const handleSavePriceChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setPriceChangeError(null);

    if (newRentInput < 0) {
      setPriceChangeError('Monthly rent cannot be negative.');
      return;
    }
    if (newFoodInput < 0) {
      setPriceChangeError('Food charge cannot be negative.');
      return;
    }

    const res = updateTenantPricing(tenant.id, newRentInput, priceChangeDate, {
      agreedFoodCharge: newFoodInput,
      reason: priceChangeReason.trim() || 'Updated pricing agreement',
    });

    if (!res.success) {
      setPriceChangeError(res.error || 'Failed to update price.');
      return;
    }

    setShowPriceModal(false);
  };

  const startEditing = () => {
    setEditName(tenant.name);
    setEditPhone(tenant.phone);
    setEditAlternatePhone(tenant.alternatePhone || '');
    setEditEmail(tenant.email || '');
    setEditHouse(tenant.permanentAddress?.house || '');
    setEditLocality(tenant.permanentAddress?.locality || '');
    setEditDistrict(tenant.permanentAddress?.district || '');
    setEditState(tenant.permanentAddress?.state || '');
    setEditPincode(tenant.permanentAddress?.pincode || '');
    setEditEmergencyName(tenant.emergencyContactName || '');
    setEditEmergencyPhone(tenant.emergencyContactPhone || tenant.emergencyContact || '');
    setEditEmergencyRelation(tenant.emergencyContactRelation || '');
    setEditEmployer(tenant.employerName || '');
    setEditJobTitle(tenant.jobTitle || '');
    setEditWorkplace(tenant.workplaceAddress || '');
    setEditEmploymentPhone(tenant.employmentPhone || '');
    setEditMonthlyRent(tenant.monthlyRent);
    setEditDueDay(tenant.monthlyDueDay);
    setEditMoveInDate(tenant.moveInDate || tenant.joiningDate);
    setIsEditing(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAddress: PermanentAddress = {
      house: editHouse.trim(),
      locality: editLocality.trim(),
      district: editDistrict.trim(),
      state: editState.trim(),
      pincode: editPincode.trim(),
    };

    updateTenant(tenant.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      alternatePhone: editAlternatePhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      permanentAddress: updatedAddress,
      emergencyContactName: editEmergencyName.trim() || undefined,
      emergencyContactPhone: editEmergencyPhone.trim() || undefined,
      emergencyContactRelation: editEmergencyRelation.trim() || undefined,
      employerName: editEmployer.trim() || undefined,
      jobTitle: editJobTitle.trim() || undefined,
      workplaceAddress: editWorkplace.trim() || undefined,
      employmentPhone: editEmploymentPhone.trim() || undefined,
      monthlyRent: editMonthlyRent,
      monthlyDueDay: editDueDay,
      moveInDate: editMoveInDate || undefined,
    });

    setIsEditing(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Quick Back Button */}
      <div className="flex items-center justify-between">
        <Link
          to="/tenants"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Tenants</span>
        </Link>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-500 rounded-xl text-xs font-semibold text-slate-700 hover:text-brand-600 shadow-2xs transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Editing</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tenant Profile Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-lg shrink-0">
            {tenant.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800">
                {tenant.status.replace('_', ' ')}
              </span>
              <RentStatusBadge status={rentStatus} balanceRemaining={balanceRemaining} />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-mono font-medium text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {tenant.phone}
              </span>
              {tenant.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {tenant.email}
                </span>
              )}
              {tenant.employerName && (
                <span className="flex items-center gap-1 font-medium text-slate-800">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {tenant.employerName}
                </span>
              )}
              <span className="flex items-center gap-1 font-semibold text-brand-700">
                <Building2 className="w-3.5 h-3.5 text-brand-500" />
                Room {room?.roomNumber} • {bed?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {balanceRemaining > 0 && tenant.status !== 'checked_out' && (
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp Reminder</span>
          </button>

          {tenant.status !== 'checked_out' && (
            <>
              <button
                type="button"
                onClick={() => setShowMoveModal(true)}
                title="Transfer to different berth"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>Move Berth</span>
              </button>

              {tenant.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Give Notice</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                <span>Checkout</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Profile Form (When Active) */}
      {isEditing && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-brand-300 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-brand-600" />
              Edit Tenant Profile & Information
            </h3>
            <span className="text-xs text-slate-400">All changes update immediately</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Phone *</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alternate Phone</label>
              <input
                type="text"
                value={editAlternatePhone}
                onChange={(e) => setEditAlternatePhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                placeholder="tenant@example.com"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employer / Company Name</label>
              <input
                type="text"
                value={editEmployer}
                onChange={(e) => setEditEmployer(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                placeholder="e.g. Infosys Ltd"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Title / Occupation</label>
              <input
                type="text"
                value={editJobTitle}
                onChange={(e) => setEditJobTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                placeholder="e.g. Software Engineer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Workplace Address</label>
              <input
                type="text"
                value={editWorkplace}
                onChange={(e) => setEditWorkplace(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                placeholder="Building, Tech Park, Locality"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employment Contact Phone</label>
              <input
                type="text"
                value={editEmploymentPhone}
                onChange={(e) => setEditEmploymentPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                placeholder="Office reception / HR"
              />
            </div>

            {/* Permanent Address */}
            <div className="md:col-span-3 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-2">Permanent Residential Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">House / Flat / Street</label>
                  <input
                    type="text"
                    value={editHouse}
                    onChange={(e) => setEditHouse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    placeholder="e.g. #42, Green Avenue"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Locality</label>
                  <input
                    type="text"
                    value={editLocality}
                    onChange={(e) => setEditLocality(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    placeholder="e.g. Jayalakshmipuram"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    placeholder="e.g. Mysuru"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={editPincode}
                    onChange={(e) => setEditPincode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                    placeholder="e.g. 570012"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="md:col-span-3 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-2">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={editEmergencyName}
                    onChange={(e) => setEditEmergencyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    placeholder="Person name"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editEmergencyPhone}
                    onChange={(e) => setEditEmergencyPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                    placeholder="Emergency mobile number"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Relationship</label>
                  <input
                    type="text"
                    value={editEmergencyRelation}
                    onChange={(e) => setEditEmergencyRelation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    placeholder="e.g. Father, Mother, Spouse"
                  />
                </div>
              </div>
            </div>

            {/* Financial & Move-in */}
            <div className="md:col-span-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Agreed Monthly Rent (₹)</label>
                  <input
                    type="number"
                    value={editMonthlyRent}
                    onChange={(e) => setEditMonthlyRent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Due Day (1-31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PG Move-in Date</label>
                  <input
                    type="date"
                    value={editMoveInDate}
                    onChange={(e) => setEditMoveInDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}

      {/* Grid: Profile Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Sections 1, 2, 3, 5 */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Contact Information & Permanent Address */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Phone className="w-3.5 h-3.5 text-brand-600" />
              1. Contact Information & Permanent Address
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Primary Phone Number</span>
                <span className="font-semibold text-slate-900 font-mono text-sm">{tenant.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Alternate Phone Number</span>
                <span className="font-medium text-slate-800 font-mono">{tenant.alternatePhone || '— Not Provided —'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Email Address</span>
                <span className="font-medium text-slate-800">{tenant.email || '— Not Provided —'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Joining Date & Move-in</span>
                <span className="font-medium text-slate-800">
                  Joined: {formatIndianDate(tenant.joiningDate)}
                  {tenant.moveInDate && tenant.moveInDate !== tenant.joiningDate && ` • Moved in: ${formatIndianDate(tenant.moveInDate)}`}
                </span>
              </div>

              {/* Permanent Address Details */}
              <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  Permanent Residential Address
                </span>
                {tenant.permanentAddress ? (
                  <div className="text-xs text-slate-800 leading-relaxed font-medium">
                    <p>{tenant.permanentAddress.house}</p>
                    <p>
                      {tenant.permanentAddress.locality}, {tenant.permanentAddress.district}
                    </p>
                    <p>
                      {tenant.permanentAddress.state} — <span className="font-mono font-bold">{tenant.permanentAddress.pincode}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No permanent address recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Employment & Occupation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              2. Employment & Occupation Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Employer / Company</span>
                <span className="font-bold text-slate-900 text-sm">{tenant.employerName || '— Not Specified —'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Job Title / Designation</span>
                <span className="font-semibold text-slate-800">{tenant.jobTitle || '— Not Specified —'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Workplace Address</span>
                <span className="font-medium text-slate-700">{tenant.workplaceAddress || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Employment Contact Phone</span>
                <span className="font-medium text-slate-800 font-mono">{tenant.employmentPhone || '—'}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: Emergency Contact */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              3. Emergency Contact Person
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Contact Person Name</span>
                <span className="font-bold text-slate-900">{tenant.emergencyContactName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Emergency Phone</span>
                <span className="font-semibold text-rose-700 font-mono">
                  {tenant.emergencyContactPhone || tenant.emergencyContact || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Relationship to Tenant</span>
                <span className="font-medium text-slate-800">{tenant.emergencyContactRelation || '—'}</span>
              </div>
            </div>
          </div>

          {/* SECTION 5: Identity & Document Management Component */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <TenantDocumentsSection tenant={tenant} />
          </div>
        </div>

        {/* Right Column (1 Col): Section 4: Rental & Ledger Information */}
        <div className="space-y-6">
          {/* Berth Allocation & Rental Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                4. Rental & Berth Information
              </h3>
              <button
                type="button"
                onClick={openPriceChange}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-lg shadow-2xs transition-colors"
              >
                Change Agreement →
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-brand-50/70 border border-brand-200/80 rounded-xl p-3">
                <span className="text-[10px] text-brand-800 font-bold uppercase block">Current Allocation</span>
                <p className="font-bold text-brand-950 text-sm mt-0.5">
                  Room {room?.roomNumber} • {bed?.label}
                </p>
                <p className="text-[11px] text-brand-700 mt-0.5">
                  Type: {bed?.bedType === 'bunk' ? `${bed.tier} berth (${bed.bunkGroup})` : 'Single Bed'}
                </p>
                <p className="text-[10px] text-brand-600 font-mono mt-1">ID: {bed?.id}</p>
              </div>

              {/* Itemized Pricing Agreement */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3 text-brand-600" />
                  Monthly Price Breakdown
                </span>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Agreed Accommodation Rent:</span>
                    <span className="font-bold font-mono text-slate-900">{formatINR(tenant.monthlyRent)}/mo</span>
                  </div>
                  {tenant.standardRent && tenant.standardRent !== tenant.monthlyRent && (
                    <div className="flex justify-between items-center text-[11px] text-slate-500 bg-white p-1 rounded border border-slate-200/60">
                      <span>Standard Room Price:</span>
                      <span>
                        {formatINR(tenant.standardRent)}
                        {tenant.standardRent > tenant.monthlyRent && (
                          <span className="text-emerald-700 font-medium"> ({formatINR(tenant.standardRent - tenant.monthlyRent)} discount)</span>
                        )}
                      </span>
                    </div>
                  )}
                  {(tenant.pricingOverrideReason || tenant.discountReason) && (
                    <p className="text-[10px] text-slate-400 italic">
                      Note: {tenant.pricingOverrideReason || tenant.discountReason}
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Utensils className="w-3 h-3 text-brand-600" />
                      Food & Catering:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {tenant.foodPlanType === 'food_included' && 'Included (₹0)'}
                      {tenant.foodPlanType === 'food_separate' && `${formatINR(tenant.agreedFoodCharge || 0)}/mo`}
                      {tenant.foodPlanType === 'no_food' && 'No Food'}
                      {tenant.foodPlanType === 'custom' && `${formatINR(tenant.agreedFoodCharge || 0)}/mo`}
                      {!tenant.foodPlanType && 'Standard'}
                    </span>
                  </div>

                  {tenant.selectedMeals && (
                    <p className="text-[10px] text-slate-500">
                      Included Meals: {Object.entries(tenant.selectedMeals).filter(([_, v]) => v).map(([m]) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ') || 'None'}
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 font-bold text-brand-900">
                    <span>Total Monthly Payable:</span>
                    <span className="font-mono text-sm">
                      {formatINR(tenant.totalMonthlyAmount || (tenant.monthlyRent + (tenant.agreedFoodCharge || 0)))}/mo
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">Due Day</span>
                  <span className="font-semibold text-slate-800">{tenant.monthlyDueDay}th of month</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Deposit Required</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {formatINR(tenant.depositRequired)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Deposit Received</span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    {formatINR(tenant.depositReceived)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Pricing Basis</span>
                  <span className="font-medium text-slate-700 capitalize">
                    {tenant.pricingBasis?.replace('_', ' ') || 'Per Person'}
                  </span>
                </div>
              </div>

              {/* Current Month Rent Status Banner */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 block">
                  Current Month ({formatBillingMonth(state.selectedMonth)})
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-slate-900">
                    Paid: <span className="text-emerald-700">{formatINR(paidThisMonth)}</span>
                  </span>
                  <span className="font-bold text-slate-900">
                    Remaining:{' '}
                    <span className={balanceRemaining > 0 ? (isOverdue ? 'text-rose-700' : 'text-amber-700') : 'text-emerald-700'}>
                      {formatINR(balanceRemaining)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Price Change Audit History */}
          {tenant.rentHistory && tenant.rentHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <History className="w-3.5 h-3.5 text-brand-600" />
                Price Agreement History ({tenant.rentHistory.length})
              </h4>
              <div className="space-y-2 text-xs">
                {tenant.rentHistory.map((h) => (
                  <div key={h.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Effective: {formatIndianDate(h.effectiveDate)}</span>
                      <span>Recorded: {formatIndianDate(h.changedAt)}</span>
                    </div>
                    <div className="font-bold text-slate-800">
                      {formatINR(h.previousRent)} → {formatINR(h.newRent)}/mo
                      {h.newFoodCharge !== undefined && (
                        <span className="text-slate-500 font-normal"> (Food: {formatINR(h.newFoodCharge)})</span>
                      )}
                    </div>
                    {h.reason && <p className="text-[10px] text-slate-500 italic">Reason: {h.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stay History Audit Log */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Stay & Berth Audit History
            </h4>

            {tenant.stayHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No stay events recorded.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {tenant.stayHistory.map((item) => (
                  <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 capitalize">{item.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{formatIndianDate(item.date)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Room {item.roomNumber} • {item.bedLabel}
                    </p>
                    {item.notes && <p className="text-[10px] text-slate-400 italic">{item.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Receipts History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              Payment Records ({allTenantPayments.length})
            </h4>

            {allTenantPayments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No payments recorded for this tenant.</p>
            ) : (
              <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                {allTenantPayments.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setViewingReceiptPayment(p)}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-brand-700 block font-mono">{p.receiptNumber}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatIndianDate(p.paymentDate)} • {p.paymentMethod}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-800 tabular-nums">{formatINR(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUB-MODALS */}
      {showPaymentModal && monthCharge && (
        <PaymentModal
          isOpen={true}
          onClose={() => setShowPaymentModal(false)}
          preselectedTenantId={tenant.id}
        />
      )}

      {showWhatsAppModal && (
        <WhatsAppPreviewModal
          isOpen={true}
          onClose={() => setShowWhatsAppModal(false)}
          tenant={tenant}
          charge={monthCharge}
          room={room}
          bed={bed}
          outstandingAmount={balanceRemaining}
        />
      )}

      {showMoveModal && (
        <TenantMoveModal
          isOpen={true}
          onClose={() => setShowMoveModal(false)}
          tenant={tenant}
        />
      )}

      {showNoticeModal && (
        <NoticeCheckoutModal
          isOpen={true}
          onClose={() => setShowNoticeModal(false)}
          tenant={tenant}
          mode="notice"
        />
      )}

      {showCheckoutModal && (
        <NoticeCheckoutModal
          isOpen={true}
          onClose={() => setShowCheckoutModal(false)}
          tenant={tenant}
          mode="checkout"
        />
      )}

      {viewingReceiptPayment && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setViewingReceiptPayment(null)}
          payment={viewingReceiptPayment}
          tenant={tenant}
          property={state.property}
          charge={
            state.rentCharges.find((c) => c.id === viewingReceiptPayment.chargeId) ||
            monthCharge || {
              id: 'charge-fallback',
              tenantId: tenant.id,
              billingMonth: viewingReceiptPayment.billingMonth,
              amount: viewingReceiptPayment.amount,
              dueDate: viewingReceiptPayment.paymentDate,
              isProrated: false,
              createdAt: viewingReceiptPayment.createdAt,
            }
          }
          remainingBalance={balanceRemaining}
        />
      )}

      {showPriceModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowPriceModal(false)}
          title="Update Agreed Price Agreement"
          size="md"
        >
          <form onSubmit={handleSavePriceChange} className="space-y-4 text-xs">
            {priceChangeError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {priceChangeError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New Monthly Accommodation Rent (INR) *
              </label>
              <input
                type="number"
                min="0"
                value={newRentInput}
                onChange={(e) => setNewRentInput(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm"
                required
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Current rent: {formatINR(tenant.monthlyRent)}/mo
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New Agreed Food Charge (INR/month)
              </label>
              <input
                type="number"
                min="0"
                value={newFoodInput}
                onChange={(e) => setNewFoodInput(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-semibold text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Leave 0 if food is included in rent or not provided.
              </p>
            </div>

            <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-brand-900">New Total Monthly Amount:</span>
              <span className="font-mono font-bold text-base text-brand-900">
                {formatINR(Number(newRentInput) + Number(newFoodInput))}/mo
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Effective Date *
              </label>
              <input
                type="date"
                value={priceChangeDate}
                onChange={(e) => setPriceChangeDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                required
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Past rent charges and payment receipts will remain completely unchanged.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Price Change *
              </label>
              <input
                type="text"
                placeholder="e.g. Annual revision, upgraded meal plan, negotiated discount"
                value={priceChangeReason}
                onChange={(e) => setPriceChangeReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPriceModal(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-2xs"
              >
                Save New Agreement
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
