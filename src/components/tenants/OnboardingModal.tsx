import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import {
  isValidIndianPhone,
  isMaskedPhone,
  isValidIndianPIN,
  isValidEmail,
  maskAadhaarNumber,
  validateDocumentUpload,
} from '../../utils/validation';
import { formatINR } from '../../utils/currency';
import { getDaysInMonth } from '../../utils/date';
import { PermanentAddress, DocumentType, MealOptions, MealPrices, PricingBasis, FoodPlanType } from '../../types';
import {
  CheckCircle2,
  AlertCircle,
  Layers,
  Briefcase,
  MapPin,
  ShieldCheck,
  UploadCloud,
  Lock,
  User,
  Phone,
  Mail,
  AlertTriangle,
  Utensils,
  Percent,
  Tag,
  Calculator,
  HelpCircle,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedRoomId?: string;
  preselectedBedId?: string;
  onSuccess?: (tenantId: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  preselectedRoomId,
  preselectedBedId,
  onSuccess,
}) => {
  const { state, allocateTenant, addTenantDocument } = useData();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Personal & Contact Details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [joiningDate, setJoiningDate] = useState(state.demoDate);
  const [moveInDate, setMoveInDate] = useState(state.demoDate);

  // Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  // Employment
  const [employerName, setEmployerName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [workplaceAddress, setWorkplaceAddress] = useState('');
  const [employmentPhone, setEmploymentPhone] = useState('');

  // Permanent Residential Address
  const [house, setHouse] = useState('');
  const [locality, setLocality] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('Karnataka');
  const [pincode, setPincode] = useState('');

  // Step 2: Bed Allocation
  const [roomId, setRoomId] = useState(preselectedRoomId || '');
  const [bedId, setBedId] = useState(preselectedBedId || '');

  // Step 3: Rent, Food, Discount & Negotiations
  const [standardRent, setStandardRent] = useState<number>(6500);
  const [agreedRent, setAgreedRent] = useState<number>(6500);
  const [hasRentOverride, setHasRentOverride] = useState(false);
  const [tenantFoodPlan, setTenantFoodPlan] = useState<FoodPlanType>('no_food');
  const [selectedMeals, setSelectedMeals] = useState<MealOptions>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [mealPrices, setMealPrices] = useState<MealPrices>({
    breakfast: 800,
    lunch: 1200,
    dinner: 1500,
  });
  const [customFoodCharge, setCustomFoodCharge] = useState<number>(0);
  const [hasFoodOverride, setHasFoodOverride] = useState(false);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [pricingOverrideReason, setPricingOverrideReason] = useState<string>('');

  const [monthlyDueDay, setMonthlyDueDay] = useState<number>(5);
  const [depositRequired, setDepositRequired] = useState<number>(10000);
  const [depositReceived, setDepositReceived] = useState<number>(10000);
  const [billingOption, setBillingOption] = useState<'full_month' | 'prorated'>('full_month');
  const [notes, setNotes] = useState('');

  // Optional Document Attachment during Onboarding
  const [attachDoc, setAttachDoc] = useState(false);
  const [onboardDocType, setOnboardDocType] = useState<DocumentType>('aadhaar');
  const [onboardDocTitle, setOnboardDocTitle] = useState('Aadhaar Identity Proof (Masked)');
  const [onboardMaskedNumber, setOnboardMaskedNumber] = useState('');
  const [onboardConsent, setOnboardConsent] = useState(true);
  const [onboardFile, setOnboardFile] = useState<File | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedRoomId) setRoomId(preselectedRoomId);
    if (preselectedBedId) {
      setBedId(preselectedBedId);
      const rm = state.rooms.find((r) => r.id === preselectedRoomId);
      const bd = rm?.beds.find((b) => b.id === preselectedBedId);
      if (bd?.monthlyRent) {
        setStandardRent(bd.monthlyRent);
        setAgreedRent(bd.monthlyRent);
      }
    }
  }, [preselectedRoomId, preselectedBedId, state.rooms]);

  const availableRooms = state.rooms.filter(
    (r) =>
      (r.roomPurpose === 'accommodation' || !r.roomPurpose) &&
      r.operationalStatus !== 'closed' &&
      r.operationalStatus !== 'storage' &&
      r.operationalStatus !== 'retired' &&
      r.status !== 'inactive' &&
      r.beds.some((b) => b.status === 'vacant')
  );
  const currentRoom = state.rooms.find((r) => r.id === roomId);

  // Tenant-level meal plan determination: meals belong exclusively to individual tenants
  const isSeparateFood = tenantFoodPlan === 'food_separate' || tenantFoodPlan === 'custom';
  const isIncludedFood = tenantFoodPlan === 'food_included';

  // Standard Food Charge based on selected meals
  const standardFoodCharge = isSeparateFood
    ? (selectedMeals.breakfast ? mealPrices.breakfast : 0) +
      (selectedMeals.lunch ? mealPrices.lunch : 0) +
      (selectedMeals.dinner ? mealPrices.dinner : 0)
    : 0;

  // Agreed Food Charge (either custom override or standard calculated)
  const effectiveAgreedFoodCharge = isSeparateFood
    ? (hasFoodOverride ? customFoodCharge : standardFoodCharge)
    : 0;

  // Discount calculation
  const calculatedDiscountAmount = discountValue > 0
    ? (discountType === 'percentage' ? Math.round((standardRent * discountValue) / 100) : discountValue)
    : 0;

  // Standard Monthly Total
  const standardMonthlyTotal = standardRent + (isSeparateFood ? standardFoodCharge : 0);

  // Final Agreed Monthly Rent (after override or discount)
  const effectiveAgreedRent = hasRentOverride
    ? agreedRent
    : Math.max(0, standardRent - calculatedDiscountAmount);

  // Final Monthly Total Payable (Rent + Agreed Food)
  const finalMonthlyTotal = effectiveAgreedRent + effectiveAgreedFoodCharge;

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setServerError(null);
      setErrors({});
      if (!name) {
        setName('');
        setPhone('');
        setAlternatePhone('');
        setEmail('');
        setJoiningDate(state.demoDate);
        setMoveInDate(state.demoDate);
        setEmergencyContactName('');
        setEmergencyContactPhone('');
        setEmergencyContactRelation('');
        setEmployerName('');
        setJobTitle('');
        setWorkplaceAddress('');
        setEmploymentPhone('');
        setHouse('');
        setLocality('');
        setDistrict('');
        setStateVal('Karnataka');
        setPincode('');
        setStandardRent(6500);
        setAgreedRent(6500);
        setHasRentOverride(false);
        setHasFoodOverride(false);
        setDiscountValue(0);
        setDiscountReason('');
        setPricingOverrideReason('');
        setMonthlyDueDay(5);
        setDepositRequired(10000);
        setDepositReceived(10000);
        setBillingOption('full_month');
        setNotes('');
        setAttachDoc(false);
        setOnboardFile(null);
      }
    }
  }, [isOpen, state.demoDate]);

  const proratedEstimate = (() => {
    try {
      const [yearStr, monthStr, dayStr] = joiningDate.split('-');
      const totalDays = getDaysInMonth(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1);
      const joiningDay = parseInt(dayStr, 10);
      const activeDays = Math.max(1, totalDays - joiningDay + 1);
      return Math.round((finalMonthlyTotal / totalDays) * activeDays);
    } catch {
      return finalMonthlyTotal;
    }
  })();

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Full name is required.';
    if (!phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!isValidIndianPhone(phone) && !isMaskedPhone(phone)) {
      errs.phone = 'Enter a valid 10-digit Indian phone number.';
    }

    if (alternatePhone.trim() && !isValidIndianPhone(alternatePhone) && !isMaskedPhone(alternatePhone)) {
      errs.alternatePhone = 'Enter a valid alternate 10-digit phone number.';
    }

    if (email.trim() && !isValidEmail(email)) {
      errs.email = 'Enter a valid email address.';
    }

    if (pincode.trim() && !isValidIndianPIN(pincode)) {
      errs.pincode = 'Enter a valid 6-digit Indian PIN code (e.g. 560038).';
    }

    if (!joiningDate) errs.joiningDate = 'Joining date is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!roomId) errs.roomId = 'Please select a room.';
    if (!bedId) errs.bedId = 'Please select an individual vacant berth.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs: Record<string, string> = {};
    if (effectiveAgreedRent < 0) errs.monthlyRent = 'Monthly rent cannot be negative.';
    if (effectiveAgreedFoodCharge < 0) errs.foodCharge = 'Food charge cannot be negative.';
    if (monthlyDueDay < 1 || monthlyDueDay > 31) errs.monthlyDueDay = 'Due day must be between 1 and 31.';
    if (depositRequired < 0) errs.depositRequired = 'Deposit cannot be negative.';
    if (depositReceived < 0) errs.depositReceived = 'Deposit received cannot be negative.';
    if (depositReceived > depositRequired) errs.depositReceived = 'Received deposit cannot exceed required deposit.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    setServerError(null);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };

  const handleSelectBed = (b: any) => {
    setBedId(b.id);
    const std = b.monthlyRent || 6500;
    setStandardRent(std);
    setAgreedRent(std);
    setHasRentOverride(false);
    setDiscountValue(0);
    setDiscountReason('');
    setPricingOverrideReason('');
  };

  const handleSubmit = () => {
    setServerError(null);

    const permanentAddress: PermanentAddress | undefined =
      house.trim() || pincode.trim() || locality.trim()
        ? {
            house: house.trim(),
            locality: locality.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            pincode: pincode.trim(),
          }
        : undefined;

    const result = allocateTenant({
      name: name.trim(),
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim() || undefined,
      email: email.trim() || undefined,
      isPhoneMasked: isMaskedPhone(phone),
      emergencyContact: emergencyContactPhone.trim() || undefined,
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      emergencyContactRelation: emergencyContactRelation.trim() || undefined,
      permanentAddress,
      employerName: employerName.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      workplaceAddress: workplaceAddress.trim() || undefined,
      employmentPhone: employmentPhone.trim() || undefined,
      joiningDate,
      moveInDate: moveInDate || joiningDate,
      roomId,
      bedId,
      pricingBasis: currentRoom?.pricingBasis || 'per_person',
      standardRent,
      monthlyRent: effectiveAgreedRent,
      foodPlanType: tenantFoodPlan,
      selectedMeals,
      standardFoodCharge,
      agreedFoodCharge: effectiveAgreedFoodCharge,
      discountType,
      discountValue,
      discountAmount: calculatedDiscountAmount,
      discountReason: discountReason.trim() || undefined,
      pricingOverrideReason: pricingOverrideReason.trim() || undefined,
      totalMonthlyAmount: finalMonthlyTotal,
      monthlyDueDay,
      depositRequired,
      depositReceived,
      notes: notes.trim() || undefined,
      billingOption,
    });

    if (!result.success) {
      setServerError(result.error || 'Failed to onboard tenant.');
    } else {
      // If user attached an initial document during onboarding, upload it
      if (attachDoc && onboardFile && result.tenant) {
        addTenantDocument(
          result.tenant.id,
          {
            documentType: onboardDocType,
            title: onboardDocTitle.trim() || 'Tenant Identity Document',
            maskedDocumentNumber: onboardMaskedNumber ? maskAadhaarNumber(onboardMaskedNumber) : undefined,
            fileName: onboardFile.name,
            fileSize: onboardFile.size,
            mimeType: onboardFile.type || 'application/pdf',
            consentObtained: onboardConsent,
            verificationNotes: 'Uploaded during initial tenant onboarding.',
          },
          onboardFile
        );
      }

      if (onSuccess && result.tenant) {
        onSuccess(result.tenant.id);
      }
      onClose();
    }
  };

  const selectedBed = currentRoom?.beds.find((b) => b.id === bedId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard New Tenant"
      description="Record comprehensive profile, allocate upper/lower berth or single bed, and verify monthly rent"
      maxWidth="lg"
    >
      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
        {[
          { num: 1, label: 'Profile & Contact' },
          { num: 2, label: 'Berth' },
          { num: 3, label: 'Rent' },
          { num: 4, label: 'Review & Docs' },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                step === s.num
                  ? 'bg-brand-600 text-white'
                  : step > s.num
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </span>
            <span
              className={`text-xs hidden sm:inline ${
                step === s.num ? 'font-bold text-slate-900' : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {serverError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* STEP 1: Personal, Contact, Employment & Address */}
      {step === 1 && (
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Section A: Basic Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
              <User className="w-3.5 h-3.5 text-brand-600" />
              A. Personal & Contact Information
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tenant Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Aditya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Phone (WhatsApp) *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alternate Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="Secondary mobile"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                {errors.alternatePhone && <p className="text-xs text-rose-600 mt-1">{errors.alternatePhone}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="tenant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Joining Date *
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PG Move-in Date
                </label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section B: Emergency Contact */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              B. Emergency Contact Person
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  placeholder="Mobile number"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                <input
                  type="text"
                  placeholder="e.g. Father, Mother, Spouse"
                  value={emergencyContactRelation}
                  onChange={(e) => setEmergencyContactRelation(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section C: Permanent Address */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              C. Permanent Residential Address
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">House / Flat / Street</label>
                <input
                  type="text"
                  placeholder="#12, Main Road"
                  value={house}
                  onChange={(e) => setHouse(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Locality</label>
                <input
                  type="text"
                  placeholder="Locality / Area"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                <input
                  type="text"
                  placeholder="District"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
                <input
                  type="text"
                  placeholder="6 digits (e.g. 560038)"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
                {errors.pincode && <p className="text-xs text-rose-600 mt-1">{errors.pincode}</p>}
              </div>
            </div>
          </div>

          {/* Section D: Employment Details */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
              <Briefcase className="w-3.5 h-3.5 text-brand-600" />
              D. Employment / Occupation Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employer / Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Infosys Ltd, TCS, Student"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title / Occupation</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Workplace Address</label>
                <input
                  type="text"
                  placeholder="Office Tech Park, Area, City"
                  value={workplaceAddress}
                  onChange={(e) => setWorkplaceAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Contact Phone</label>
                <input
                  type="tel"
                  placeholder="Work reception / HR number"
                  value={employmentPhone}
                  onChange={(e) => setEmploymentPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Berth Allocation (Grouped Bunk Beds & Single Beds) */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Room *
            </label>
            <select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setBedId('');
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">-- Choose a room with vacant berths --</option>
              {availableRooms.map((r) => {
                const floor = state.floors.find((f) => f.id === r.floorId);
                const vacantCount = r.beds.filter((b) => b.status === 'vacant').length;
                return (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} ({floor?.name || 'Floor'}) • {r.sharingType} • {r.hasAc ? 'AC' : 'Non-AC'} ({vacantCount} vacant berths)
                  </option>
                );
              })}
            </select>
            {errors.roomId && <p className="text-xs text-rose-600 mt-1">{errors.roomId}</p>}
          </div>

          {currentRoom && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Sleeping Berth in Room {currentRoom.roomNumber} *
              </label>

              <div className="space-y-3 max-h-60 overflow-y-auto p-1">
                {/* Visual Bunk Groups */}
                {Array.from(new Set(currentRoom.beds.filter((b) => b.bedType === 'bunk').map((b) => b.bunkGroup || 'Bunk 1'))).map((groupName) => {
                  const berthsInGroup = currentRoom.beds.filter((b) => b.bunkGroup === groupName);

                  return (
                    <div key={groupName} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-brand-600" />
                        <span>{groupName} (Bunk Bed)</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {berthsInGroup.map((b) => {
                          const isVacant = b.status === 'vacant';
                          const isSelected = bedId === b.id;

                          return (
                            <button
                              type="button"
                              key={b.id}
                              disabled={!isVacant}
                              onClick={() => handleSelectBed(b)}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'border-brand-600 bg-brand-50/70 ring-2 ring-brand-500'
                                  : isVacant
                                  ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400'
                                  : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span>{b.tier === 'upper' ? 'Upper Berth' : 'Lower Berth'}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isVacant ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                  {b.status}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-brand-700 block mt-1 tabular-nums">
                                {formatINR(b.monthlyRent)}/mo
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono block truncate mt-0.5">
                                {b.id}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Standalone Single Beds */}
                {currentRoom.beds.filter((b) => b.bedType === 'single').length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 block">Single Beds</span>
                    <div className="grid grid-cols-2 gap-2">
                      {currentRoom.beds.filter((b) => b.bedType === 'single').map((b) => {
                        const isVacant = b.status === 'vacant';
                        const isSelected = bedId === b.id;

                        return (
                          <button
                            type="button"
                            key={b.id}
                            disabled={!isVacant}
                            onClick={() => handleSelectBed(b)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'border-brand-600 bg-brand-50/70 ring-2 ring-brand-500'
                                : isVacant
                                ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400'
                                : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>{b.label}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isVacant ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                {b.status}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-brand-700 block mt-1 tabular-nums">
                              {formatINR(b.monthlyRent)}/mo
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono block truncate mt-0.5">
                              {b.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {errors.bedId && <p className="text-xs text-rose-600 mt-1">{errors.bedId}</p>}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Rent, Food, Discount & Negotiations */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Section 1: Standard Pricing Baseline */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-brand-600" />
                Accommodation & Meal Baseline
              </span>
              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                {currentRoom?.pricingBasis === 'per_room' ? 'Per Room Basis' : 'Per Person / Month'}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Room / Berth Standard Rent</span>
                <span className="text-xs text-slate-400">Pure accommodation cost excluding meals</span>
              </div>
              <span className="text-base font-bold text-slate-900 font-mono">
                {formatINR(standardRent)} <span className="text-xs font-normal text-slate-500">/ mo</span>
              </span>
            </div>

            {/* Tenant Meal Plan Selection */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                Resident Meal Plan Choice
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { id: 'no_food', label: 'No Food', desc: 'Self-cooking / outside' },
                  { id: 'food_separate', label: 'Select Meals', desc: 'Charged per meal' },
                  { id: 'food_included', label: 'Food Included', desc: 'In accommodation' },
                  { id: 'custom', label: 'Custom Plan', desc: 'Special package' },
                ].map((plan) => (
                  <button
                    type="button"
                    key={plan.id}
                    onClick={() => setTenantFoodPlan(plan.id as any)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      tenantFoodPlan === plan.id
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

            {/* Meal Selection if Food is Separate */}
            {isSeparateFood && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700">
                    Select Resident Meals (Standard Rates):
                  </span>
                  <span className="text-[11px] font-mono text-brand-700 font-semibold">
                    Total: {formatINR(standardFoodCharge)}/mo
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-brand-300">
                    <input
                      type="checkbox"
                      checked={selectedMeals.breakfast}
                      onChange={(e) => setSelectedMeals({ ...selectedMeals, breakfast: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <div>
                      <span className="font-semibold block text-[11px]">Breakfast</span>
                      <span className="text-[10px] text-slate-500 font-mono">{formatINR(mealPrices.breakfast)}/mo</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-brand-300">
                    <input
                      type="checkbox"
                      checked={selectedMeals.lunch}
                      onChange={(e) => setSelectedMeals({ ...selectedMeals, lunch: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <div>
                      <span className="font-semibold block text-[11px]">Lunch</span>
                      <span className="text-[10px] text-slate-500 font-mono">{formatINR(mealPrices.lunch)}/mo</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-brand-300">
                    <input
                      type="checkbox"
                      checked={selectedMeals.dinner}
                      onChange={(e) => setSelectedMeals({ ...selectedMeals, dinner: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <div>
                      <span className="font-semibold block text-[11px]">Dinner</span>
                      <span className="text-[10px] text-slate-500 font-mono">{formatINR(mealPrices.dinner)}/mo</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Individual Pricing & Negotiations */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-brand-600" />
                Agreed Rent & Special Terms (Individual Agreement)
              </span>
              <span className="text-[11px] text-slate-400">Standard room price is preserved</span>
            </div>

            {/* Rent Pricing Mode */}
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rentMode"
                    checked={!hasRentOverride && discountValue === 0}
                    onChange={() => {
                      setHasRentOverride(false);
                      setDiscountValue(0);
                      setAgreedRent(standardRent);
                    }}
                    className="text-brand-600"
                  />
                  <span>Standard Price ({formatINR(standardRent)}/mo)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rentMode"
                    checked={!hasRentOverride && discountValue > 0}
                    onChange={() => {
                      setHasRentOverride(false);
                      if (discountValue === 0) setDiscountValue(500);
                    }}
                    className="text-brand-600"
                  />
                  <span>Apply Discount (Friend / Corporate / Long Stay)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rentMode"
                    checked={hasRentOverride}
                    onChange={() => setHasRentOverride(true)}
                    className="text-brand-600"
                  />
                  <span>Custom Agreed Rent (Direct Override)</span>
                </label>
              </div>

              {/* Discount inputs */}
              {!hasRentOverride && discountValue > 0 && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discount Type</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="amount">Fixed Amount (₹)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reason / Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Relative / 1-year commitment"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Direct override input */}
              {hasRentOverride && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Agreed Monthly Rent (INR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={agreedRent}
                      onChange={(e) => setAgreedRent(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Reason for Custom Pricing
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Special negotiation approved by owner"
                      value={pricingOverrideReason}
                      onChange={(e) => setPricingOverrideReason(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Custom Food Charge Override */}
              {isSeparateFood && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={hasFoodOverride}
                        onChange={(e) => setHasFoodOverride(e.target.checked)}
                        className="rounded text-brand-600"
                      />
                      <span>Override Food Charge for This Resident</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Standard: {formatINR(standardFoodCharge)}/mo
                    </span>
                  </div>

                  {hasFoodOverride && (
                    <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Agreed Food Charge (INR/mo)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={customFoodCharge}
                          onChange={(e) => setCustomFoodCharge(Number(e.target.value))}
                          className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-mono font-bold"
                        />
                      </div>
                      <div className="flex items-end pb-1 text-[11px] text-slate-500">
                        {customFoodCharge < standardFoodCharge ? (
                          <span className="text-emerald-700 font-medium">
                            Concession: {formatINR(standardFoodCharge - customFoodCharge)}/mo off meals
                          </span>
                        ) : (
                          <span>Custom meal arrangement</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Transparent Pricing Breakdown (Formula & Zero Double-Counting) */}
          <div className="p-3.5 bg-brand-50/60 rounded-xl border border-brand-200 space-y-2 text-xs">
            <div className="flex items-center justify-between text-brand-900 font-bold">
              <span>Standard Monthly Total:</span>
              <span className="tabular-nums font-mono text-sm">
                {formatINR(standardMonthlyTotal)} / mo
              </span>
            </div>

            <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-brand-200/60 pt-1.5">
              <div className="flex justify-between">
                <span>Standard Room/Berth Rent:</span>
                <span className="font-mono">{formatINR(standardRent)}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected Food Charges:</span>
                <span className="font-mono">
                  {isIncludedFood ? '₹0 (Included in Rent)' : isSeparateFood ? formatINR(standardFoodCharge) : '₹0 (No Food)'}
                </span>
              </div>
              {calculatedDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Negotiated Rent Discount:</span>
                  <span className="font-mono">- {formatINR(calculatedDiscountAmount)}</span>
                </div>
              )}
              {hasFoodOverride && customFoodCharge !== standardFoodCharge && (
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Food Charge Adjustment:</span>
                  <span className="font-mono">
                    {customFoodCharge < standardFoodCharge ? `- ${formatINR(standardFoodCharge - customFoodCharge)}` : `+ ${formatINR(customFoodCharge - standardFoodCharge)}`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-brand-950 font-bold border-t border-brand-200 pt-1.5 text-sm">
              <span>Final Agreed Monthly Total:</span>
              <span className="text-base font-mono font-extrabold text-brand-800">
                {formatINR(finalMonthlyTotal)} / mo
              </span>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Formula: Final agreed rent ({formatINR(effectiveAgreedRent)}) + agreed food ({formatINR(effectiveAgreedFoodCharge)}) = {formatINR(finalMonthlyTotal)}
            </p>
          </div>

          {/* Section 4: Due Day, First Month Billing & Deposit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Monthly Due Day (1 - 31) *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={monthlyDueDay}
                onChange={(e) => setMonthlyDueDay(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Rent due date each month</span>
              {errors.monthlyDueDay && <p className="text-xs text-rose-600 mt-1">{errors.monthlyDueDay}</p>}
            </div>

            {/* First Month Billing Policy */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                First Month Billing Policy *
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className={`p-2 rounded-xl border cursor-pointer flex flex-col ${billingOption === 'full_month' ? 'border-brand-600 bg-brand-50/60 font-semibold' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="billingOption"
                      value="full_month"
                      checked={billingOption === 'full_month'}
                      onChange={() => setBillingOption('full_month')}
                    />
                    <span>Full Month</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    {formatINR(finalMonthlyTotal)}
                  </span>
                </label>

                <label className={`p-2 rounded-xl border cursor-pointer flex flex-col ${billingOption === 'prorated' ? 'border-brand-600 bg-brand-50/60 font-semibold' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="billingOption"
                      value="prorated"
                      checked={billingOption === 'prorated'}
                      onChange={() => setBillingOption('prorated')}
                    />
                    <span>Prorated</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Est. {formatINR(proratedEstimate)}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Security Deposit Required (INR)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={depositRequired}
                onChange={(e) => setDepositRequired(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Deposit Received Now (INR)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={depositReceived}
                onChange={(e) => setDepositReceived(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums font-semibold"
              />
              {errors.depositReceived && <p className="text-xs text-rose-600 mt-1">{errors.depositReceived}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Work details, vehicle parking details, special requests"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* STEP 4: Review, Identity Document Attachment & Inventory */}
      {step === 4 && (
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="bg-brand-50 border border-brand-200 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider mb-2">
              Allocation Summary
            </h4>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-slate-500">Tenant:</span>
              <span className="font-bold text-slate-900">{name}</span>

              <span className="text-slate-500">Phone:</span>
              <span className="font-semibold text-slate-900 font-mono">{phone}</span>

              {employerName && (
                <>
                  <span className="text-slate-500">Employer:</span>
                  <span className="font-semibold text-slate-800">{employerName}</span>
                </>
              )}

              {house && (
                <>
                  <span className="text-slate-500">Permanent Address:</span>
                  <span className="text-slate-800 text-[11px] truncate">
                    {house}, {locality}, {district} - {pincode}
                  </span>
                </>
              )}

              <span className="text-slate-500">Room & Berth:</span>
              <span className="font-bold text-brand-700">
                Room {currentRoom?.roomNumber} • {selectedBed?.label} ({selectedBed?.bedType === 'bunk' ? `${selectedBed.tier} berth` : 'single'})
              </span>

              <span className="text-slate-500">Berth Unique ID:</span>
              <span className="font-mono text-slate-700 text-[11px] truncate">
                {selectedBed?.id}
              </span>

              <span className="text-slate-500">Joining Date:</span>
              <span className="font-medium text-slate-900">{joiningDate}</span>

              <span className="text-slate-500">Standard Pricing:</span>
              <span className="font-mono text-slate-700">{formatINR(standardMonthlyTotal)} / mo (Standard Room + Food)</span>

              <span className="text-slate-500">Agreed Room Rent:</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatINR(effectiveAgreedRent)}
                {hasRentOverride && ' (Custom override)'}
                {!hasRentOverride && calculatedDiscountAmount > 0 && ` (${formatINR(calculatedDiscountAmount)} discount)`}
              </span>

              <span className="text-slate-500">Food Arrangement:</span>
              <span className="font-semibold text-slate-800">
                {isIncludedFood && 'Food included in rent'}
                {isSeparateFood && `${formatINR(effectiveAgreedFoodCharge)}/mo (${Object.entries(selectedMeals).filter(([_, v]) => v).map(([m]) => m).join(', ') || 'No meals'})`}
                {!isIncludedFood && !isSeparateFood && 'No food provided'}
              </span>

              <span className="text-slate-500">Final Monthly Payable:</span>
              <span className="font-extrabold text-brand-800 font-mono text-sm">
                {formatINR(finalMonthlyTotal)} (Due on {monthlyDueDay}th)
              </span>

              <span className="text-slate-500">First Month Charge:</span>
              <span className="font-bold text-slate-900 font-mono">
                {billingOption === 'prorated' ? `${formatINR(proratedEstimate)} (Prorated)` : `${formatINR(finalMonthlyTotal)} (Full Month)`}
              </span>

              <span className="text-slate-500">Deposit Paid:</span>
              <span className="font-bold text-emerald-800">{formatINR(depositReceived)} of {formatINR(depositRequired)}</span>
            </div>
          </div>

          {/* Optional Document Upload during Onboarding */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
              <input
                type="checkbox"
                checked={attachDoc}
                onChange={(e) => setAttachDoc(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Attach Initial Identity / Aadhaar Document (Optional)</span>
            </label>

            {attachDoc && (
              <div className="space-y-3 pt-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Doc Type</label>
                    <select
                      value={onboardDocType}
                      onChange={(e) => {
                        const t = e.target.value as DocumentType;
                        setOnboardDocType(t);
                        setOnboardDocTitle(
                          t === 'aadhaar'
                            ? 'Aadhaar Identity Proof (Masked)'
                            : t === 'employment_id'
                            ? 'Employment / Company ID Card'
                            : 'Identity Proof'
                        );
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="aadhaar">Aadhaar Card (Masked)</option>
                      <option value="employment_id">Company ID Card</option>
                      <option value="address_proof">Address Proof</option>
                      <option value="other_id">Other Government ID</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Masked Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="•••• •••• 1234"
                      value={onboardMaskedNumber}
                      onChange={(e) => setOnboardMaskedNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Choose File (PDF, JPEG, PNG, WebP)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setOnboardFile(e.target.files?.[0] || null)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                  />
                </div>

                {onboardDocType === 'aadhaar' && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-amber-900 leading-tight">
                      <input
                        type="checkbox"
                        checked={onboardConsent}
                        onChange={(e) => setOnboardConsent(e.target.checked)}
                        className="rounded text-brand-600 mt-0.5"
                      />
                      <span>
                        Tenant consent obtained for identity verification. Full Aadhaar number is masked.
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Standard Room Inventory Provided (Good Condition)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span>• Foam Mattress</span>
              <span>• Comfort Pillow</span>
              <span>• Room & Bed Key</span>
              <span>• Wardrobe / Cupboard Key</span>
              <span>• Study Table & Chair</span>
              <span>• Ceiling Fan</span>
              <span>• Geyser Hot Water Facility</span>
              <span>• Individual Bed Light & Socket</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as any)}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            ← Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Confirm & Onboard Tenant
          </button>
        )}
      </div>
    </Modal>
  );
};
