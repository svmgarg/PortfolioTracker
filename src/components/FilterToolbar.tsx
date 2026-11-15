import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, RotateCcw, Search, X } from 'lucide-react';
import type { ClassificationFilter } from '../types/portfolio';

interface FilterToolbarProps {
  scripts: string[];
  selectedScript: string;
  classification: ClassificationFilter;
  searchQuery: string;
  filteredCount: number;
  onScriptChange: (script: string) => void;
  onClassificationChange: (classification: ClassificationFilter) => void;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
  onExport: (format: 'xlsx' | 'csv') => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  scripts,
  selectedScript,
  classification,
  searchQuery,
  filteredCount,
  onScriptChange,
  onClassificationChange,
  onSearchChange,
  onResetFilters,
  onExport,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const hasActiveFilters =
    selectedScript !== 'ALL' || classification !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="bg-slate-50/70 border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        {/* Script Dropdown */}
        <div className="min-w-[220px] sm:max-w-[280px]">
          <label
            htmlFor="script-filter-select"
            className="block text-xs font-semibold text-slate-600 mb-1.5"
          >
            Filter by Script
          </label>
          <select
            id="script-filter-select"
            value={selectedScript}
            onChange={(e) => onScriptChange(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Scripts ({scripts.length})</option>
            {scripts.map((script) => (
              <option key={script} value={script}>
                {script}
              </option>
            ))}
          </select>
        </div>

        {/* Classification Buttons */}
        <div>
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">
            Classification
          </span>
          <div
            role="group"
            aria-label="Filter by holding classification"
            className="inline-flex h-10 p-1 bg-slate-200/70 rounded-lg border border-slate-200"
          >
            {(['LT', 'ST', 'ALL'] as const).map((option) => {
              const label = option === 'ALL' ? 'All' : option;
              const isSelected = classification === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onClassificationChange(option)}
                  className={`px-3.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 h-10 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Search + Export */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="relative w-full sm:w-64">
          <label htmlFor="script-search-input" className="sr-only">
            Search script
          </label>
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="script-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search script..."
            className="w-full h-10 pl-9 pr-8 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative shrink-0" ref={exportMenuRef}>
          <div className="inline-flex rounded-lg shadow-xs">
            <button
              type="button"
              disabled={filteredCount === 0}
              onClick={() => onExport('xlsx')}
              className="inline-flex items-center gap-2 h-10 px-4 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-l-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              disabled={filteredCount === 0}
              onClick={() => setExportOpen((prev) => !prev)}
              aria-label="More export options"
              aria-expanded={exportOpen}
              className="inline-flex items-center justify-center h-10 px-2.5 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed border-l border-blue-500 rounded-r-lg transition-colors cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {exportOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExport('xlsx');
                }}
                className="w-full text-left px-3.5 py-2 text-xs sm:text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium cursor-pointer"
              >
                Export as Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExport('csv');
                }}
                className="w-full text-left px-3.5 py-2 text-xs sm:text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium cursor-pointer"
              >
                Export as CSV (.csv)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
