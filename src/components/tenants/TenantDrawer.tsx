import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '../common/Drawer';
import { Tenant, RentCharge, PaymentRecord, PermanentAddress, FoodPlanType, MealOptions } from '../../types';
import { useData } from '../../persistence/DataContext';
import { formatINR } from '../../utils/currency';
import { formatIndianDate, formatBillingMonth } from '../../utils/date';
import { BedStatusBadge, RentStatusBadge } from '../common/Badge';
import { PaymentModal } from './PaymentModal';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';
import { TenantMoveModal } from './TenantMoveModal';
import { NoticeCheckoutModal } from './NoticeCheckoutModal';
import { ReceiptModal } from './ReceiptModal';
import { TenantDocumentsSection } from './TenantDocumentsSection';
import {
  CreditCard,
  MessageCircle,
  ArrowRightLeft,
  CalendarCheck,
  DoorOpen,
  Edit2,
  Clock,
  Package,
  Receipt,
  Phone,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Briefcase,
  MapPin,
  Mail,
  ShieldCheck,
  Tag,
  Utensils,
  History,
  Calculator,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface TenantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string | null;
}

export const TenantDrawer: React.FC<TenantDrawerProps> = ({ isOpen, onClose, tenantId }) => {
  const { state, updateTenant, updateTenantPricing } = useData();

  // Active sub-modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [viewingReceiptPayment, setViewingReceiptPayment] = useState<PaymentRecord | null>(null);

  // Price change modal state
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [newRentInput, setNewRentInput] = useState(0);
  const [newFoodPlan, setNewFoodPlan] = useState<FoodPlanType>('no_food');
  const [newSelectedMeals, setNewSelectedMeals] = useState<MealOptions>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [newFoodInput, setNewFoodInput] = useState(0);
  const [priceChangeDate, setPriceChangeDate] = useState(state.demoDate);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [priceChangeError, setPriceChangeError] = useState<string | null>(null);

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editMonthlyRent, setEditMonthlyRent] = useState(0);

  const tenant = state.tenants.find((t) => t.id === tenantId);

  // Initialize edit fields when editing starts
  const startEditing = () => {
    if (!tenant) return;
    setEditName(tenant.name);
    setEditPhone(tenant.phone);
    setEditEmergency(tenant.emergencyContact || '');
    setEditMonthlyRent(tenant.monthlyRent);
    setIsEditing(true);
  };

  const saveEditing = () => {
    if (!tenant) return;
    updateTenant(tenant.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      emergencyContact: editEmergency.trim(),
      monthlyRent: editMonthlyRent,
    });
    setIsEditing(false);
  };

  const openPriceChange = () => {
    if (!tenant) return;
    setNewRentInput(tenant.monthlyRent);
    setNewFoodPlan(tenant.foodPlanType || (tenant.agreedFoodCharge ? 'food_separate' : 'no_food'));
    setNewSelectedMeals(tenant.selectedMeals || { breakfast: false, lunch: false, dinner: false });
    setNewFoodInput(tenant.agreedFoodCharge || 0);
    setPriceChangeDate(state.demoDate);
    setPriceChangeReason('');
    setPriceChangeError(null);
    setShowPriceModal(true);
  };

  const handleMealToggle = (meal: 'breakfast' | 'lunch' | 'dinner', checked: boolean) => {
    const updatedMeals = { ...newSelectedMeals, [meal]: checked };
    setNewSelectedMeals(updatedMeals);
    const calculatedSum =
      (updatedMeals.breakfast ? 800 : 0) +
      (updatedMeals.lunch ? 1200 : 0) +
      (updatedMeals.dinner ? 1500 : 0);
    setNewFoodInput(calculatedSum);
  };

  const handleFoodPlanChange = (plan: FoodPlanType) => {
    setNewFoodPlan(plan);
    if (plan === 'no_food' || plan === 'food_included') {
      setNewFoodInput(0);
    } else if (plan === 'food_separate') {
      const calculatedSum =
        (newSelectedMeals.breakfast ? 800 : 0) +
        (newSelectedMeals.lunch ? 1200 : 0) +
        (newSelectedMeals.dinner ? 1500 : 0);
      setNewFoodInput(calculatedSum);
    }
  };

  const handleSavePriceChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setPriceChangeError(null);

    if (newRentInput < 0) {
      setPriceChangeError('Monthly rent cannot be negative.');
      return;
    }
    const finalFoodCharge = newFoodPlan === 'no_food' || newFoodPlan === 'food_included' ? 0 : newFoodInput;
    if (finalFoodCharge < 0) {
      setPriceChangeError('Food charge cannot be negative.');
      return;
    }

    const res = updateTenantPricing(tenant.id, newRentInput, priceChangeDate, {
      agreedFoodCharge: finalFoodCharge,
      foodPlanType: newFoodPlan,
      selectedMeals: newSelectedMeals,
      reason: priceChangeReason.trim() || 'Updated pricing agreement',
    });

    if (!res.success) {
      setPriceChangeError(res.error || 'Failed to update price.');
      return;
    }

    setShowPriceModal(false);
  };

  if (!tenant) return null;

  const room = state.rooms.find((r) => r.id === tenant.roomId);
  const bed = room?.beds.find((b) => b.id === tenant.bedId);

  // Charges for this tenant
  const tenantCharges = state.rentCharges.filter((c) => c.tenantId === tenant.id);
  // Current month charge
  const currentMonthCharge = tenantCharges.find((c) => c.billingMonth === state.selectedMonth);

  // Payments for this tenant
  const tenantPayments = state.payments.filter((p) => p.tenantId === tenant.id);

  // Outstanding amount for selectedMonth
  const currentPaid = currentMonthCharge
    ? tenantPayments
        .filter((p) => p.chargeId === currentMonthCharge.id)
        .reduce((sum, p) => sum + p.amount, 0)
    : 0;
  const currentBalance = currentMonthCharge ? Math.max(0, currentMonthCharge.amount - currentPaid) : 0;

  // Rent status for current month
  let rentStatus: 'paid' | 'overdue' | 'due_soon' | 'partially_paid' = 'due_soon';
  if (currentBalance <= 0) {
    rentStatus = 'paid';
  } else if (state.demoDate > (currentMonthCharge?.dueDate || '')) {
    rentStatus = 'overdue';
  } else if (currentPaid > 0) {
    rentStatus = 'partially_paid';
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={tenant.name}
        subtitle={`Room ${room?.roomNumber || '—'} • ${bed?.label || '—'} • Joined ${formatIndianDate(tenant.joiningDate)}`}
      >
        {/* Top Badges & Quick Action Grid */}
        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {bed && <BedStatusBadge status={bed.status} />}
            <RentStatusBadge status={rentStatus} balanceRemaining={currentBalance} />
          </div>

          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs px-2 py-1 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditing}
                className="text-xs px-2.5 py-1 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 shadow-2xs"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            disabled={tenant.status === 'checked_out' || currentBalance === 0}
            onClick={() => setShowPaymentModal(true)}
            className="flex flex-col items-center justify-center p-2.5 bg-brand-50 hover:bg-brand-100 text-brand-800 disabled:opacity-40 disabled:cursor-not-allowed border border-brand-200 rounded-xl text-center transition-colors"
          >
            <CreditCard className="w-4 h-4 mb-1 text-brand-600" />
            <span className="text-[11px] font-bold">Record Rent</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="flex flex-col items-center justify-center p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-center transition-colors"
          >
            <MessageCircle className="w-4 h-4 mb-1 text-emerald-600" />
            <span className="text-[11px] font-bold">WhatsApp</span>
          </button>

          <button
            type="button"
            disabled={tenant.status === 'checked_out'}
            onClick={() => setShowMoveModal(true)}
            className="flex flex-col items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-40 border border-slate-200 rounded-xl text-center transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4 mb-1 text-slate-500" />
            <span className="text-[11px] font-bold">Move Bed</span>
          </button>

          {tenant.status === 'notice' ? (
            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="flex flex-col items-center justify-center p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-center transition-colors"
            >
              <DoorOpen className="w-4 h-4 mb-1 text-rose-600" />
              <span className="text-[11px] font-bold">Check Out</span>
            </button>
          ) : tenant.status === 'active' ? (
            <button
              type="button"
              onClick={() => setShowNoticeModal(true)}
              className="flex flex-col items-center justify-center p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-center transition-colors"
            >
              <CalendarCheck className="w-4 h-4 mb-1 text-amber-600" />
              <span className="text-[11px] font-bold">Give Notice</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center p-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-medium">Checked Out</span>
            </div>
          )}
        </div>

        {/* Dedicated Link to Full Tenant Details Page */}
        <Link
          to={`/tenants/${tenant.id}`}
          onClick={onClose}
          className="w-full py-2.5 px-3 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <ExternalLink className="w-4 h-4 text-brand-600" />
          <span>Open Full Tenant Details Page (5 Sections)</span>
        </Link>

        {/* SECTION 1: Tenant Profile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              Tenant Profile & Assignment
            </h3>
            <Link
              to={`/tenants/${tenant.id}`}
              onClick={onClose}
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
            >
              <span>Full Details</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {!isEditing ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Phone Number</span>
                <span className="font-semibold text-slate-800 font-mono">{tenant.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Alternate Phone</span>
                <span className="font-medium text-slate-800 font-mono">{tenant.alternatePhone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Email Address</span>
                <span className="font-medium text-slate-800">{tenant.email || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Employer / Company</span>
                <span className="font-semibold text-slate-800">{tenant.employerName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Allocated Berth</span>
                <span className="font-semibold text-slate-800">
                  Room {room?.roomNumber} • {bed?.label} ({bed?.bedType === 'bunk' ? `${bed.tier} berth` : 'single bed'})
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  ID: {bed?.id}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Emergency Contact</span>
                <span className="font-medium text-slate-800">
                  {tenant.emergencyContactName ? `${tenant.emergencyContactName} (${tenant.emergencyContactRelation || 'Contact'})` : tenant.emergencyContact || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Joining Date</span>
                <span className="font-medium text-slate-800">{formatIndianDate(tenant.joiningDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Monthly Due Day</span>
                <span className="font-medium text-slate-800">{tenant.monthlyDueDay}th of each month</span>
              </div>

              {/* Dedicated Pricing & Agreement Card */}
              <div className="col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand-600" />
                    Rent & Food Pricing Agreement
                  </span>
                  <button
                    type="button"
                    onClick={openPriceChange}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs"
                  >
                    Change Agreement →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Agreed Accommodation Rent</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {formatINR(tenant.monthlyRent)}/mo
                    </span>
                    {tenant.standardRent && tenant.standardRent !== tenant.monthlyRent && (
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Standard: {formatINR(tenant.standardRent)} • {tenant.standardRent > tenant.monthlyRent ? `${formatINR(tenant.standardRent - tenant.monthlyRent)} concession` : 'Custom rate'}
                      </span>
                    )}
                    {(tenant.pricingOverrideReason || tenant.discountReason) && (
                      <span className="text-[10px] text-slate-400 italic block">
                        "{tenant.pricingOverrideReason || tenant.discountReason}"
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Food & Catering Plan</span>
                    <span className="font-semibold text-slate-800 block">
                      {tenant.foodPlanType === 'food_included' && 'Food Included in Rent (₹0 extra)'}
                      {tenant.foodPlanType === 'food_separate' && `Food: ${formatINR(tenant.agreedFoodCharge || 0)}/mo`}
                      {tenant.foodPlanType === 'no_food' && 'No Food Provided'}
                      {tenant.foodPlanType === 'custom' && `Custom Food: ${formatINR(tenant.agreedFoodCharge || 0)}/mo`}
                      {!tenant.foodPlanType && 'Standard Room Plan'}
                    </span>
                    {tenant.selectedMeals && (
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Meals: {Object.entries(tenant.selectedMeals).filter(([_, v]) => v).map(([m]) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ') || 'None'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Total Monthly Amount Payable:</span>
                  <span className="font-mono font-bold text-sm text-brand-800">
                    {formatINR(tenant.totalMonthlyAmount || (tenant.monthlyRent + (tenant.agreedFoodCharge || 0)))} / mo
                  </span>
                </div>

                {tenant.rentHistory && tenant.rentHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 mt-2 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <History className="w-3 h-3 text-slate-400" />
                      Price Audit Trail ({tenant.rentHistory.length})
                    </span>
                    <div className="space-y-1">
                      {tenant.rentHistory.map((h) => (
                        <div key={h.id} className="text-[11px] bg-white border border-slate-200 rounded p-1.5 text-slate-600">
                          <div className="flex justify-between font-mono text-[10px] text-slate-500">
                            <span>Effective: {formatIndianDate(h.effectiveDate)}</span>
                            <span>Recorded: {formatIndianDate(h.changedAt)}</span>
                          </div>
                          <div className="font-semibold text-slate-800">
                            {formatINR(h.previousRent)} → {formatINR(h.newRent)}/mo
                            {h.newFoodCharge !== undefined && (
                              <span className="text-slate-500 font-normal"> (Food: {formatINR(h.newFoodCharge)})</span>
                            )}
                          </div>
                          {h.reason && <p className="text-[10px] text-slate-500 italic mt-0.5">Reason: {h.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 block">Security Deposit</span>
                <span className="font-semibold text-emerald-800 tabular-nums">
                  {formatINR(tenant.depositReceived)} of {formatINR(tenant.depositRequired)}
                </span>
              </div>

              {tenant.permanentAddress && (
                <div className="col-span-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Permanent Residential Address</span>
                  <p className="mt-0.5">
                    {tenant.permanentAddress.house}, {tenant.permanentAddress.locality}, {tenant.permanentAddress.district}, {tenant.permanentAddress.state} - {tenant.permanentAddress.pincode}
                  </p>
                </div>
              )}

              {tenant.status === 'notice' && (
                <div className="col-span-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                  <span className="font-bold">Notice Active:</span> Expected move-out on{' '}
                  <strong>{formatIndianDate(tenant.expectedMoveOutDate || '')}</strong>.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={editEmergency}
                  onChange={(e) => setEditEmergency(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Rent (INR)</label>
                <input
                  type="number"
                  value={editMonthlyRent}
                  onChange={(e) => setEditMonthlyRent(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Rent & Payment History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              Rent Charges & Payment Records
            </h3>
            {tenant.status !== 'checked_out' && currentBalance > 0 && (
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
              >
                + Record Payment
              </button>
            )}
          </div>

          <div className="space-y-2">
            {tenantCharges.map((charge) => {
              const paymentsForCharge = tenantPayments.filter((p) => p.chargeId === charge.id);
              const totalPaidForCharge = paymentsForCharge.reduce((sum, p) => sum + p.amount, 0);
              const chargeBal = charge.amount - totalPaidForCharge;
              const isOverdue = state.demoDate > charge.dueDate && chargeBal > 0;

              return (
                <div
                  key={charge.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatBillingMonth(charge.billingMonth)}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Due: {formatIndianDate(charge.dueDate)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-slate-900 text-sm tabular-nums">
                        {formatINR(charge.amount)}
                      </span>
                      <div className="mt-0.5">
                        {chargeBal <= 0 ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Fully Paid
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Overdue ({formatINR(chargeBal)})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Due Soon ({formatINR(chargeBal)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment transactions for this charge */}
                  {paymentsForCharge.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 bg-slate-50/60 p-2 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Payments Received
                      </span>
                      {paymentsForCharge.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-800">{formatINR(p.amount)}</span>
                            <span className="text-slate-500 ml-1.5">
                              via {p.paymentMethod} on {formatIndianDate(p.paymentDate)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingReceiptPayment(p)}
                            className="text-brand-600 hover:text-brand-700 font-semibold underline text-[10px]"
                          >
                            Receipt
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Assigned Room Inventory */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-500" />
            Assigned Room Inventory Checklist
          </h3>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
            {tenant.assignedInventory.map((item) => (
              <div key={item.id} className="p-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="text-[10px] text-slate-400 block">
                    Issued: {formatIndianDate(item.checkInDate)}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.condition === 'Good' || item.condition === 'New'
                        ? 'bg-emerald-50 text-emerald-800'
                        : item.condition === 'Fair'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-rose-50 text-rose-800'
                    }`}
                  >
                    {item.condition}
                  </span>
                  {item.checkOutCondition && (
                    <span className="text-[10px] text-slate-500 block">
                      Returned: {item.checkOutCondition}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: Identity & Document Management */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <TenantDocumentsSection tenant={tenant} />
        </div>

        {/* SECTION 5: Stay & Bed Movement History */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Stay & Movement Timeline
          </h3>
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 text-xs">
            {tenant.stayHistory.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 border-l-2 border-brand-500 pl-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 capitalize">
                      {item.action.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatIndianDate(item.date)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Room {item.roomNumber}, Bed {item.bedLabel}
                    {item.notes ? ` • ${item.notes}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* Sub-modals */}
      {showPaymentModal && currentMonthCharge && (
        <PaymentModal
          isOpen={true}
          onClose={() => setShowPaymentModal(false)}
          preselectedTenantId={tenant.id}
          preselectedChargeId={currentMonthCharge.id}
        />
      )}

      {showWhatsAppModal && (
        <WhatsAppPreviewModal
          isOpen={true}
          onClose={() => setShowWhatsAppModal(false)}
          tenant={tenant}
          charge={currentMonthCharge}
          room={room}
          bed={bed}
          outstandingAmount={currentBalance}
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

      {showPriceModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowPriceModal(false)}
          title="Update Pricing Agreement"
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
                Monthly Accommodation Rent (INR) *
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
                Current accommodation rent: {formatINR(tenant.monthlyRent)}/mo
              </p>
            </div>

            {/* Resident Meal Plan */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Resident Meal Plan Choice
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'no_food', label: 'No Food', desc: 'Self cook / outside (₹0)' },
                  { id: 'food_separate', label: 'Select Meals', desc: 'Pay per meal selected' },
                  { id: 'food_included', label: 'Food Included', desc: 'Included in rent (₹0)' },
                  { id: 'custom', label: 'Custom Plan', desc: 'Custom food amount' },
                ].map((plan) => (
                  <button
                    type="button"
                    key={plan.id}
                    onClick={() => handleFoodPlanChange(plan.id as FoodPlanType)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      newFoodPlan === plan.id
                        ? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-500 font-bold text-brand-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{plan.label}</span>
                    <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">{plan.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Meal Checkboxes if Separate */}
            {newFoodPlan === 'food_separate' && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Select Applicable Meals:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSelectedMeals.breakfast}
                      onChange={(e) => handleMealToggle('breakfast', e.target.checked)}
                      className="rounded text-brand-600"
                    />
                    <div>
                      <span className="font-semibold block text-[11px]">Breakfast</span>
                      <span className="text-[10px] text-slate-500">₹800/mo</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSelectedMeals.lunch}
                      onChange={(e) => handleMealToggle('lunch', e.target.checked)}
                      className="rounded text-brand-600"
                    />
                    <div>
                      <span className="font-semibold block text-[11px]">Lunch</span>
                      <span className="text-[10px] text-slate-500">₹1,200/mo</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSelectedMeals.dinner}
                      onChange={(e) => handleMealToggle('dinner', e.target.checked)}
                      className="rounded text-brand-600"
                    />
                    <div>
                      <span className="font-semibold block text-[11px]">Dinner</span>
                      <span className="text-[10px] text-slate-500">₹1,500/mo</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Food charge input for separate or custom */}
            {(newFoodPlan === 'food_separate' || newFoodPlan === 'custom') && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Agreed Food Charge (INR/month)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newFoodInput}
                  onChange={(e) => setNewFoodInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-semibold text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Editable if special discount or custom arrangement is approved.
                </p>
              </div>
            )}

            <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg flex justify-between items-center">
              <div>
                <span className="font-semibold text-brand-900 block">Total Monthly Payable</span>
                <span className="text-[11px] text-brand-700">
                  Rent: {formatINR(newRentInput)} + Food: {formatINR(newFoodPlan === 'no_food' || newFoodPlan === 'food_included' ? 0 : newFoodInput)}
                </span>
              </div>
              <span className="font-mono font-bold text-base text-brand-900">
                {formatINR(Number(newRentInput) + (newFoodPlan === 'no_food' || newFoodPlan === 'food_included' ? 0 : Number(newFoodInput)))}/mo
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

      {viewingReceiptPayment && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setViewingReceiptPayment(null)}
          payment={viewingReceiptPayment}
          tenant={tenant}
          property={state.property}
          charge={
            tenantCharges.find((c) => c.id === viewingReceiptPayment.chargeId) ||
            currentMonthCharge ||
            tenantCharges[0]
          }
          remainingBalance={0}
        />
      )}
    </>
  );
};

