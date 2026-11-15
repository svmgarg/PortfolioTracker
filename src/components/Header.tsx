import React from 'react';
import { BarChart3, Plus, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
  hasSources: boolean;
  holdingPeriodMonths: number;
  onOpenAddSource: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasSources,
  holdingPeriodMonths,
  onOpenAddSource,
  onOpenSettings,
}) => {
  return (
    <header className="bg-[#0F2544] text-white border-b border-slate-800">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-600/25 border border-blue-400/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-blue-200" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
              Portfolio Tax Tracker
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 truncate">
              Stock &amp; ETF Holding Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-blue-100 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            title="Configure holding-period threshold"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            <span>Settings</span>
            <span className="font-mono text-xs text-blue-200">({holdingPeriodMonths}m)</span>
          </button>

          {hasSources && (
            <button
              type="button"
              onClick={onOpenAddSource}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Source</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
