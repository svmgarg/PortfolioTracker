import React from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import type { ClassificationFilter, LoadedSource } from '../types/portfolio';

interface FilterToolbarProps {
  sources: LoadedSource[];
  selectedSource: string;
  scripts: string[];
  selectedScript: string;
  classification: ClassificationFilter;
  searchQuery: string;
  onSourceChange: (sourceId: string) => void;
  onScriptChange: (script: string) => void;
  onClassificationChange: (classification: ClassificationFilter) => void;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  sources,
  selectedSource,
  scripts,
  selectedScript,
  classification,
  searchQuery,
  onSourceChange,
  onScriptChange,
  onClassificationChange,
  onSearchChange,
  onResetFilters,
}) => {
  const hasActiveFilters =
    selectedSource !== 'ALL' ||
    selectedScript !== 'ALL' ||
    classification !== 'ALL' ||
    searchQuery.trim() !== '';

  return (
    <div className="bg-slate-50/70 border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        {/* Source / Broker Dropdown */}
        <div className="min-w-[160px] sm:max-w-[210px]">
          <label
            htmlFor="source-filter-select"
            className="block text-xs font-semibold text-slate-600 mb-1.5"
          >
            Filter by Source
          </label>
          <select
            id="source-filter-select"
            value={selectedSource}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Sources ({sources.length})</option>
            {sources.map((src) => (
              <option key={src.sourceId} value={src.sourceId}>
                {src.brokerLabel}
              </option>
            ))}
          </select>
        </div>

        {/* Script Dropdown */}
        <div className="min-w-[210px] sm:max-w-[260px]">
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
              const label =
                option === 'LT' ? 'Long Term' : option === 'ST' ? 'Short Term' : 'All';
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

      {/* Search */}
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
    </div>
  );
};
