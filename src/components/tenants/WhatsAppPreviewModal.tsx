import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Tenant, RentCharge, Property, Room, Bed } from '../../types';
import { useData } from '../../persistence/DataContext';
import { formatINR } from '../../utils/currency';
import { formatIndianDate } from '../../utils/date';
import { isValidIndianPhone, generateWhatsAppLink } from '../../utils/validation';
import { Copy, Check, MessageSquare, AlertTriangle, ExternalLink } from 'lucide-react';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  charge?: RentCharge;
  room?: Room;
  bed?: Bed;
  outstandingAmount: number;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  isOpen,
  onClose,
  tenant,
  charge,
  room,
  bed,
  outstandingAmount,
}) => {
  const { state, logWhatsAppActivity } = useData();
  const [copied, setCopied] = useState(false);

  if (!tenant) return null;

  const roomNum = room?.roomNumber || 'Assigned Room';
  const bedLbl = bed?.label ? (bed.bedType === 'bunk' ? `${bed.label} (${bed.tier} berth)` : bed.label) : 'Berth';
  const dueDateStr = charge ? formatIndianDate(charge.dueDate) : 'due date';
  const isOverdue = charge ? state.demoDate > charge.dueDate : false;

  // Prepare custom message wording based on status
  let message = '';
  if (isOverdue) {
    message = `Hello ${tenant.name}, this is an urgent reminder from ${state.property.name} that your overdue rent of ${formatINR(outstandingAmount)} for Room ${roomNum}, ${bedLbl}, was due on ${dueDateStr}. Kindly clear this pending balance at the earliest and share the payment confirmation. UPI ID: ${state.property.upiId}. Thank you!`;
  } else {
    message = `Hello ${tenant.name}, this is a gentle reminder from ${state.property.name} that your outstanding rent of ${formatINR(outstandingAmount)} for Room ${roomNum}, ${bedLbl}, is due on ${dueDateStr}. Kindly complete the payment and share the confirmation. UPI ID: ${state.property.upiId}. Thank you!`;
  }

  const isPhoneValid = isValidIndianPhone(tenant.phone);
  const waLink = isPhoneValid ? generateWhatsAppLink(tenant.phone, message) : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    logWhatsAppActivity(tenant.id, 'prepared', message, tenant.phone);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!waLink) return;
    logWhatsAppActivity(tenant.id, 'opened', message, tenant.phone);
    window.open(waLink, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="WhatsApp Rent Reminder"
      description={`Prepare and preview reminder message for ${tenant.name}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Masked Phone warning for seed demo tenants */}
        {!isPhoneValid ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Demo Masked Number ({tenant.phone}):</strong>
              <p className="mt-0.5 text-amber-800">
                Direct WhatsApp link is disabled to protect fictitious or unverified phone numbers. You can still preview and copy the generated message below, or edit the tenant's phone number to test WhatsApp opening.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <span>Valid recipient phone: <strong>{tenant.phone}</strong></span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              Ready to Send
            </span>
          </div>
        )}

        {/* Message Preview Box */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
            Prepared WhatsApp Template
          </label>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap select-all shadow-2xs">
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Message Text</span>
              </>
            )}
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!isPhoneValid}
              onClick={handleOpenWhatsApp}
              className="w-1/2 sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

