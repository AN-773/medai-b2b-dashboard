import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, ChevronDown, File } from 'lucide-react';
import { testsService } from '../../services/testsService';

interface ImportLearningObjectivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ImportLearningObjectivesModal: React.FC<ImportLearningObjectivesModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [exam, setExam] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setExam('');
      setFile(null);
      setError(null);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }
    if (!exam) {
      setError('Please select an exam target.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload File
      const fileId = await testsService.uploadFile(file);
      // 2. Import Learning Objectives
      await testsService.importLearningObjectives(fileId, exam);
      
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import learning objectives.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#1BD183] to-[#15a968] rounded-2xl shadow-lg shadow-[#1BD183]/20">
              <Upload size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Import Learning Objectives</h2>
              <p className="text-sm text-slate-500 font-medium">Upload CSV containing your objectives mapping</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">CSV File <span className="text-red-500">*</span></label>
              
              <div 
                className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                 <File size={32} className="text-slate-400 mb-2" />
                 {file ? (
                   <span className="text-sm font-bold text-slate-700">{file.name}</span>
                 ) : (
                   <span className="text-sm font-medium text-slate-500">Click to select a CSV file</span>
                 )}
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Exam Target <span className="text-red-500">*</span></label>
              <div className="relative">
                <select 
                  value={exam}
                  onChange={(e) => setExam(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all"
                >
                  <option value="" disabled>Select an Exam...</option>
                  <option value="STEP 1">STEP 1</option>
                  <option value="STEP 2">STEP 2</option>
                  <option value="STEP 3">STEP 3</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || !file || !exam}
              className="px-6 py-3 bg-gradient-to-r from-[#1BD183] to-[#15a968] text-white text-sm font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                 <><Loader2 size={16} className="animate-spin" /> Uploading...</>
              ) : (
                 'Import Objectives'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportLearningObjectivesModal;
