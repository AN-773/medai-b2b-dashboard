import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  id: string;
  name: string;
}

interface MultiSearchableSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  options,
  values,
  onChange,
  placeholder = 'Select options...',
  label,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter(option =>
    option?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOptions = options.filter(opt => values.includes(opt.id));

  const handleSelect = (optionId: string) => {
    if (values.includes(optionId)) {
      onChange(values.filter(v => v !== optionId));
    } else {
      onChange([...values, optionId]);
    }
  };

  const removeValue = (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    onChange(values.filter(v => v !== optionId));
  };

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-[#1BD183] outline-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px] ${
            isOpen ? 'ring-2 ring-[#1BD183] border-[#1BD183]' : ''
          }`}
        >
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-w-[90%]">
              {selectedOptions.map(opt => (
                <span key={opt.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-sm text-[10px] font-bold uppercase tracking-tight">
                  {opt.name}
                  <X 
                    size={10} 
                    className="text-slate-400 hover:text-rose-500 cursor-pointer" 
                    onClick={(e) => removeValue(e, opt.id)}
                  />
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 font-bold uppercase tracking-tight px-2">{placeholder}</span>
          )}
          
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ml-2 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1BD183] outline-none transition"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs font-bold text-slate-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = values.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-[#1BD183]/10 text-[#1BD183]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="uppercase tracking-tight">{option.name}</span>
                      {isSelected && <Check size={14} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSearchableSelect;
