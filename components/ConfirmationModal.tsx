import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/20',
      button: 'bg-gradient-to-r from-rose-500 to-rose-600  hover:-translate-y-0.5',
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20',
      button: 'bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5',
    },
    info: {
      iconBg: 'bg-gradient-to-br from-[#1BD183] to-[#15a968] shadow-lg shadow-[#1BD183]/20',
      button: 'bg-gradient-to-r from-[#1BD183] to-[#15a968] ',
    },
  };

  const styles = variantStyles[variant];

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${styles.iconBg}`}>
              <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{title}</h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 text-white text-sm font-bold rounded-xl transition-all ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default ConfirmationModal;
