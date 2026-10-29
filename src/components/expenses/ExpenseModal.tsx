import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../persistence/DataContext';
import { Expense, ExpenseCategory } from '../../types';
import { AlertCircle, IndianRupee, Trash2 } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  expenseToEdit,
}) => {
  const { state, addExpense, updateExpense, deleteExpense } = useData();

  const [title, setTitle] = useState(expenseToEdit?.title || '');
  const [category, setCategory] = useState<ExpenseCategory>(expenseToEdit?.category || 'Electricity');
  const [amount, setAmount] = useState<number>(expenseToEdit?.amount || 0);
  const [paymentDate, setPaymentDate] = useState(expenseToEdit?.paymentDate || state.demoDate);
  const [paymentMode, setPaymentMode] = useState<Expense['paymentMode']>(expenseToEdit?.paymentMode || 'UPI');
  const [notes, setNotes] = useState(expenseToEdit?.notes || '');
  const [error, setError] = useState<string | null>(null);

  const categories: ExpenseCategory[] = [
    'Electricity',
    'Water',
    'Mess / groceries',
    'Staff salary',
    'Internet',
    'Maintenance',
    'Property rent / EMI',
    'Miscellaneous',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Expense title is required.');
      return;
    }
    if (amount <= 0) {
      setError('Expense amount must be greater than ₹0.');
      return;
    }

    if (expenseToEdit) {
      updateExpense(expenseToEdit.id, {
        title: title.trim(),
        category,
        amount,
        paymentDate,
        paymentMode,
        notes: notes.trim() || undefined,
      });
      onClose();
    } else {
      addExpense({
        title: title.trim(),
        category,
        amount,
        paymentDate,
        paymentMode,
        notes: notes.trim() || undefined,
      });
      onClose();
    }
  };

  const handleDelete = () => {
    if (!expenseToEdit) return;
    const confirm = window.confirm(`Delete expense record "${expenseToEdit.title}"?`);
    if (!confirm) return;
    deleteExpense(expenseToEdit.id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expenseToEdit ? 'Edit Expense Record' : 'Record Operating Expense'}
      description="Track property operating outflows for cash flow calculation"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Expense Title / Payee *
          </label>
          <input
            type="text"
            placeholder="e.g. KSEB Electricity Bill, Cook Salary, Milma Milk"
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
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Amount (INR) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <IndianRupee className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="1"
                step="50"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Amount"
                className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
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
              <option value="Bank Transfer">Bank Transfer (NEFT)</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Notes / Vendor Details (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Reference number, invoice details, remarks"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          {expenseToEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            {expenseToEdit && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              {expenseToEdit ? 'Update Expense' : 'Record Outflow'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

