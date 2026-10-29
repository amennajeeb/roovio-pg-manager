import React, { useState } from 'react';
import { Tenant, TenantDocument, DocumentType, DocumentVerificationStatus } from '../../types';
import { useData } from '../../persistence/DataContext';
import { validateDocumentUpload, maskAadhaarNumber } from '../../utils/validation';
import { formatIndianDate } from '../../utils/date';
import {
  FileText,
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Lock,
  Info,
  X,
  FileCheck,
} from 'lucide-react';

interface TenantDocumentsSectionProps {
  tenant: Tenant;
}

export const TenantDocumentsSection: React.FC<TenantDocumentsSectionProps> = ({ tenant }) => {
  const {
    addTenantDocument,
    updateDocumentVerification,
    replaceTenantDocument,
    deleteTenantDocument,
    getSecureDocumentAccess,
    getSecureDocumentAccessAsync,
  } = useData();

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState<TenantDocument | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState<TenantDocument | null>(null);
  const [viewingDocUrl, setViewingDocUrl] = useState<{ url: string; title: string; mimeType: string } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Upload Form State
  const [docType, setDocType] = useState<DocumentType>('aadhaar');
  const [title, setTitle] = useState('Aadhaar Identity Proof (Masked)');
  const [maskedNumber, setMaskedNumber] = useState('');
  const [consentObtained, setConsentObtained] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Verify Form State
  const [verifyStatus, setVerifyStatus] = useState<DocumentVerificationStatus>('verified');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Replace Form State
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const documents = tenant.documents || [];

  // Reset upload form
  const openUploadModal = (type: DocumentType = 'aadhaar') => {
    setDocType(type);
    setTitle(
      type === 'aadhaar'
        ? 'Aadhaar Identity Proof (Masked)'
        : type === 'employment_id'
        ? 'Employment / Company ID Card'
        : type === 'address_proof'
        ? 'Permanent Address Proof'
        : type === 'other_id'
        ? 'Government Identity Document'
        : 'Additional Verification Document'
    );
    setMaskedNumber('');
    setConsentObtained(type === 'aadhaar');
    setSelectedFile(null);
    setVerificationNotes('');
    setUploadError(null);
    setShowUploadModal(true);
  };

  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    if (type === 'aadhaar') {
      setTitle('Aadhaar Identity Proof (Masked)');
      setConsentObtained(true);
    } else if (type === 'employment_id') {
      setTitle('Employment / Company ID Card');
      setConsentObtained(true);
    } else if (type === 'address_proof') {
      setTitle('Permanent Address Proof');
      setConsentObtained(true);
    } else if (type === 'other_id') {
      setTitle('Government Identity Document');
      setConsentObtained(true);
    } else {
      setTitle('Verification Document');
      setConsentObtained(true);
    }
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!title.trim()) {
      setUploadError('Document title is required.');
      return;
    }

    if (docType === 'aadhaar' && !consentObtained) {
      setUploadError('Explicit tenant consent is legally required before processing Aadhaar.');
      return;
    }

    if (!selectedFile) {
      setUploadError('Please choose a file to upload (PDF, JPEG, PNG, or WebP).');
      return;
    }

    const validation = validateDocumentUpload(selectedFile);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file.');
      return;
    }

    const result = addTenantDocument(
      tenant.id,
      {
        documentType: docType,
        title: title.trim(),
        maskedDocumentNumber: maskedNumber ? maskAadhaarNumber(maskedNumber) : undefined,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || 'application/pdf',
        consentObtained,
        verificationNotes: verificationNotes.trim() || undefined,
      },
      selectedFile
    );

    if (!result.success) {
      setUploadError(result.error || 'Failed to upload document.');
      return;
    }

    setShowUploadModal(false);
  };

  const handleSecureView = async (doc: TenantDocument) => {
    setErrorBanner(null);
    let access = getSecureDocumentAccess(tenant.id, doc.id);
    if ((access.error || !access.url) && getSecureDocumentAccessAsync) {
      access = await getSecureDocumentAccessAsync(tenant.id, doc.id);
    }
    if (access.error || !access.url) {
      setErrorBanner(access.error || 'Failed to generate secure viewing authorization.');
      return;
    }
    setViewingDocUrl({
      url: access.url,
      title: doc.title,
      mimeType: doc.mimeType,
    });
  };

  const handleSecureDownload = async (doc: TenantDocument) => {
    setErrorBanner(null);
    let access = getSecureDocumentAccess(tenant.id, doc.id);
    if ((access.error || !access.url) && getSecureDocumentAccessAsync) {
      access = await getSecureDocumentAccessAsync(tenant.id, doc.id);
    }
    if (access.error || !access.url) {
      setErrorBanner(access.error || 'Failed to generate secure download authorization.');
      return;
    }

    const link = document.createElement('a');
    link.href = access.url;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showVerifyModal) return;

    if (verifyStatus === 'rejected' && !rejectionReason.trim()) {
      setVerifyError('A specific reason is required when rejecting a document.');
      return;
    }

    const res = updateDocumentVerification(
      tenant.id,
      showVerifyModal.id,
      verifyStatus,
      verifyNotes,
      rejectionReason
    );

    if (!res.success) {
      setVerifyError(res.error || 'Failed to update verification status.');
      return;
    }

    setShowVerifyModal(null);
  };

  const handleReplaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReplaceModal || !replaceFile) {
      setReplaceError('Please select a replacement file.');
      return;
    }

    const validation = validateDocumentUpload(replaceFile);
    if (!validation.valid) {
      setReplaceError(validation.error || 'Invalid file.');
      return;
    }

    const res = replaceTenantDocument(tenant.id, showReplaceModal.id, replaceFile);
    if (!res.success) {
      setReplaceError(res.error || 'Failed to replace file.');
      return;
    }

    setShowReplaceModal(null);
  };

  const handleDelete = (docId: string, title: string) => {
    if (window.confirm(`Are you sure you want to permanently delete "${title}"? This cannot be undone.`)) {
      deleteTenantDocument(tenant.id, docId);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            Identity & Document Management
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Encrypted private tenant documents with short-lived owner authorization.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openUploadModal('aadhaar')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Security & Aadhaar Privacy Notice */}
      <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-blue-950">
            Aadhaar Privacy & Legal Compliance Notice
          </p>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Per Indian privacy regulations, full 12-digit Aadhaar numbers are never collected, stored, or exported.
            Only masked credentials (<span className="font-mono font-semibold">•••• •••• 1234</span>) are maintained.
            All document files reside strictly in private storage with authenticated PG owner isolation.
          </p>
        </div>
      </div>

      {errorBanner && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700">No documents uploaded yet</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
            Upload Aadhaar identity proof, permanent address verification, or company ID to maintain compliance.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => openUploadModal('aadhaar')}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 hover:border-brand-500 rounded-lg text-slate-700 font-medium transition-colors shadow-2xs"
            >
              + Upload Aadhaar (Masked)
            </button>
            <button
              type="button"
              onClick={() => openUploadModal('employment_id')}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 hover:border-brand-500 rounded-lg text-slate-700 font-medium transition-colors shadow-2xs"
            >
              + Upload Company ID
            </button>
            <button
              type="button"
              onClick={() => openUploadModal('address_proof')}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 hover:border-brand-500 rounded-lg text-slate-700 font-medium transition-colors shadow-2xs"
            >
              + Upload Address Proof
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 shadow-2xs transition-all space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{doc.title}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {doc.documentType.replace('_', ' ')}
                      </span>

                      {/* Verification Status Badge */}
                      {doc.verificationStatus === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified
                        </span>
                      )}
                      {doc.verificationStatus === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Review
                        </span>
                      )}
                      {doc.verificationStatus === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap font-medium">
                      {doc.maskedDocumentNumber && (
                        <span className="font-mono text-slate-600 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                          {doc.maskedDocumentNumber}
                        </span>
                      )}
                      <span>File: {doc.fileName}</span>
                      <span>Size: {formatFileSize(doc.fileSize)}</span>
                      <span>Uploaded: {formatIndianDate(doc.uploadedAt.slice(0, 10))}</span>
                    </div>
                  </div>
                </div>

                {/* Document Actions */}
                <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSecureView(doc)}
                    title="Secure View"
                    className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSecureDownload(doc)}
                    title="Secure Download"
                    className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVerifyModal(doc);
                      setVerifyStatus(doc.verificationStatus);
                      setVerifyNotes(doc.verificationNotes || '');
                      setRejectionReason(doc.rejectionReason || '');
                      setVerifyError(null);
                    }}
                    title="Change Verification Status"
                    className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplaceModal(doc);
                      setReplaceFile(null);
                      setReplaceError(null);
                    }}
                    title="Replace Document"
                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id, doc.title)}
                    title="Delete Document"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Verification Notes / Rejection Reason Callout */}
              {doc.verificationNotes && (
                <div className="text-[11px] bg-slate-50 p-2 rounded-lg text-slate-600 flex items-start gap-1.5 border border-slate-150">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Verification Note:</strong> {doc.verificationNotes}
                  </span>
                </div>
              )}

              {doc.verificationStatus === 'rejected' && doc.rejectionReason && (
                <div className="text-[11px] bg-rose-50 p-2 rounded-lg text-rose-800 flex items-start gap-1.5 border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rejection Reason:</strong> {doc.rejectionReason}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: Upload New Document */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-brand-600" />
                Upload Tenant Document
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-3.5 text-xs">
              {uploadError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Category *</label>
                <select
                  value={docType}
                  onChange={(e) => handleDocTypeChange(e.target.value as DocumentType)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="aadhaar">Aadhaar Identity Proof (Masked)</option>
                  <option value="employment_id">Employment / Company ID Card</option>
                  <option value="address_proof">Permanent Address Proof</option>
                  <option value="other_id">Other Government ID (PAN, Voter ID, Passport)</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="e.g. Aadhaar Card (Masked)"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Masked Number / Identifier (Optional)
                </label>
                <input
                  type="text"
                  value={maskedNumber}
                  onChange={(e) => setMaskedNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder={docType === 'aadhaar' ? '•••• •••• 1234 (last 4 digits only)' : 'e.g. EMP-10492'}
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {docType === 'aadhaar'
                    ? 'Only the last 4 digits are recorded. Full 12-digit numbers are automatically masked.'
                    : 'Identifier for owner tracking.'}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Choose File (PDF, JPEG, PNG, WebP) *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Max file size: 10MB. Stored in private owner bucket.</span>
              </div>

              {/* Consent Checkbox */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentObtained}
                    onChange={(e) => setConsentObtained(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 mt-0.5"
                  />
                  <span className="text-[11px] text-amber-950 font-medium leading-tight">
                    Tenant Consent Confirmed: The tenant has provided explicit consent to collect, securely store, and verify this document strictly for PG accommodation purposes.
                  </span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Verification Notes (Optional)</label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="e.g. Original physical card inspected by reception warden."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Upload & Secure Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Verification Status */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Update Verification Status
              </h3>
              <button
                type="button"
                onClick={() => setShowVerifyModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerificationSubmit} className="space-y-3.5 text-xs">
              {verifyError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block text-[11px]">Document</span>
                <span className="font-bold text-slate-900">{showVerifyModal.title}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Set Verification Status *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('verified')}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                      verifyStatus === 'verified'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Verified
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('pending')}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                      verifyStatus === 'pending'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyStatus('rejected')}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-colors ${
                      verifyStatus === 'rejected'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Rejected
                  </button>
                </div>
              </div>

              {verifyStatus === 'rejected' && (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Rejection Reason *</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-rose-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    placeholder="e.g. Photo unreadable or expired card"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Verification Notes (Optional)</label>
                <textarea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="e.g. Verified against original Aadhaar during physical check-in."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(null)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Save Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Replace Document File */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                Replace Document File
              </h3>
              <button
                type="button"
                onClick={() => setShowReplaceModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-3.5 text-xs">
              {replaceError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{replaceError}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block text-[11px]">Replacing file for</span>
                <span className="font-bold text-slate-900">{showReplaceModal.title}</span>
                <span className="text-[11px] text-slate-400 block">Current file: {showReplaceModal.fileName}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select New File (Max 10MB) *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  required
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                Replacing this file will reset the document's verification status back to <strong>Pending</strong> so it can be re-inspected.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(null)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Upload Replacement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Secure Document Viewer */}
      {viewingDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  {viewingDocUrl.title}
                </h3>
                <p className="text-[10px] text-slate-400">
                  Temporary signed access token • Authenticated owner view only
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingDocUrl(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-[350px] max-h-[650px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-2">
              {viewingDocUrl.mimeType.startsWith('image/') ? (
                <img
                  src={viewingDocUrl.url}
                  alt={viewingDocUrl.title}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={viewingDocUrl.url}
                  title={viewingDocUrl.title}
                  className="w-full h-full min-h-[450px] border-0 rounded-lg"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Protected under tenant privacy consent
              </span>
              <button
                type="button"
                onClick={() => setViewingDocUrl(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

