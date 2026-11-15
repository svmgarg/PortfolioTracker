import React, { useRef } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { LoadedSource } from '../types/portfolio';
import { formatCalendarDateReadable } from '../utils/calculations';

interface SourcesBarProps {
  sources: LoadedSource[];
  onRemoveSource: (sourceId: string) => void;
  onClearAll: () => void;
  onAddFiles: (files: FileList | File[]) => void;
}

export const SourcesBar: React.FC<SourcesBarProps> = ({
  sources,
  onRemoveSource,
  onClearAll,
  onAddFiles,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  if (sources.length === 0) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
    e.target.value = '';
  };

  return (
    <section
      aria-label="Loaded data sources"
      className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-xs font-semibold text-slate-600 mr-1 whitespace-nowrap">
          Loaded Sources ({sources.length}):
        </span>
        {sources.map((src) => (
          <div
            key={src.sourceId}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
          >
            <span className="font-semibold text-slate-900">{src.brokerLabel}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="tabular-nums text-slate-600">
              {src.activeLots.length} active / {src.closedTrades.length} closed
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {formatCalendarDateReadable(src.valuationDate)}
            </span>
            <button
              type="button"
              onClick={() => onRemoveSource(src.sourceId)}
              aria-label={`Remove ${src.brokerLabel} source`}
              title="Remove this source"
              className="ml-0.5 p-0.5 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          onChange={handleInputChange}
          className="hidden"
          aria-label="Add another broker report"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add File</span>
        </button>

        {sources.length > 1 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear All</span>
          </button>
        )}
      </div>
    </section>
  );
};
