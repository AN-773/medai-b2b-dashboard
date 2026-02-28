import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';

interface BulkProgressModalProps {
  isOpen: boolean;
  title: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  isProcessing: boolean;
  onClose: () => void;
}

const BulkProgressModal: React.FC<BulkProgressModalProps> = ({
  isOpen,
  title,
  totalItems,
  completedItems,
  failedItems,
  isProcessing,
  onClose,
}) => {
  if (!isOpen) return null;

  const progress = totalItems > 0 ? ((completedItems + failedItems) / totalItems) * 100 : 0;
  const isDone = !isProcessing && (completedItems + failedItems) === totalItems && totalItems > 0;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-lg ${
              isDone && failedItems === 0 
                ? 'bg-gradient-to-br from-[#1BD183] to-[#15a968] shadow-[#1BD183]/20' 
                : isDone && failedItems > 0
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/20'
                  : 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/20'
            }`}>
              {isProcessing ? (
                <Loader2 size={24} className="animate-spin text-white" />
              ) : isDone && failedItems === 0 ? (
                <CheckCircle2 size={24} className="text-white" />
              ) : (
                <XCircle size={24} className="text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500 font-medium">
                {isProcessing ? 'Please wait...' : isDone ? 'Operation complete' : ''}
              </p>
            </div>
          </div>
          {isDone && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  failedItems > 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-[#1BD183] to-[#15a968]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs font-bold text-slate-400 text-right">
              {Math.round(progress)}%
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
              <CheckCircle2 size={14} className="text-[#1BD183]" />
              <span className="text-sm font-bold text-slate-700">{completedItems} done</span>
            </div>
            {failedItems > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 rounded-xl">
                <XCircle size={14} className="text-rose-500" />
                <span className="text-sm font-bold text-rose-700">{failedItems} failed</span>
              </div>
            )}
            <div className="flex items-center px-4 py-2 bg-slate-50 rounded-xl">
              <span className="text-sm font-bold text-slate-400">
                {completedItems + failedItems} / {totalItems}
              </span>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        {isDone && (
          <div className="flex items-center justify-end p-6 pt-0">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl  transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

export default BulkProgressModal;
