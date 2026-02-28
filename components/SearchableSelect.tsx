import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, Plus } from 'lucide-react';

export interface SelectOption {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  allOption?: { id: string; name: string };
  className?: string;
  onAddClick?: () => void;
  addLabel?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  disabled = false,
  allOption = { id: 'ALL', name: 'All' },
  className = '',
  onAddClick,
  addLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popupDirection, setPopupDirection] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 320; // Approx height of search input + max-h-60 list

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setPopupDirection('up');
      } else {
        setPopupDirection('down');
      }
    }
  }, [isOpen]);

  const allOptions = [allOption, ...options];

  const filteredOptions = allOptions.filter(option =>
    option?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = allOptions.find(opt => opt.id === value);
  const displayValue = selectedOption?.name || placeholder;

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(allOption.id);
    setSearchQuery('');
  };

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      {label && (
        <div className="flex justify-between items-center px-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            {label}
          </label>
          {onAddClick && (
            <button 
              type="button" 
              onClick={(e) => { e.preventDefault(); onAddClick(); }} 
              className="text-[9px] font-bold text-[#1BD183] uppercase tracking-widest hover:text-[#14A567] flex items-center gap-1"
            >
              <Plus size={10} strokeWidth={3} /> {addLabel || 'Add'}
            </button>
          )}
        </div>
      )}
      
      <div className="relative">
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase tracking-tight text-slate-700 focus:ring-2 focus:ring-[#1BD183] outline-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isOpen ? 'ring-2 ring-[#1BD183] border-[#1BD183]' : ''
          }`}
        >
          <span className={value === allOption.id ? 'text-slate-400' : 'text-slate-700'}>
            {displayValue}
          </span>
          <div className="flex items-center gap-2">
            {value !== allOption.id && !disabled && (
              <X
                size={14}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                onClick={handleClear}
              />
            )}
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div 
            className={`absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-200 ${
              popupDirection === 'up' ? 'bottom-full mb-2 slide-in-from-bottom-2' : 'top-full mt-2 slide-in-from-top-2'
            }`}
          >
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
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold transition-colors ${
                      value === option.id
                        ? 'bg-[#1BD183]/10 text-[#1BD183]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="uppercase tracking-tight">{option.name}</span>
                    {value === option.id && <Check size={14} />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchableSelect;
