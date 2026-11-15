import React, { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { LoadedSource } from '../types/portfolio';
import { formatCalendarDateReadable } from '../utils/calculations';

interface SourcesBarProps {
  sources: LoadedSource[];
  onRenameSource: (sourceId: string, newLabel: string) => void;
  onRemoveSource: (sourceId: string) => void;
  onClearAll: () => void;
  onOpenAddSource: () => void;
}

export const SourcesBar: React.FC<SourcesBarProps> = ({
  sources,
  onRenameSource,
  onRemoveSource,
  onClearAll,
  onOpenAddSource,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  if (sources.length === 0) return null;

  const startEditing = (src: LoadedSource) => {
    setEditingId(src.sourceId);
    setDraftLabel(src.brokerLabel);
  };

  const commitEdit = (sourceId: string) => {
    const trimmed = draftLabel.trim();
    if (trimmed) {
      onRenameSource(sourceId, trimmed);
    }
    setEditingId(null);
    setDraftLabel('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftLabel('');
  };

  return (
    <section
      aria-label="Loaded data sources"
      className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-xs font-semibold text-slate-600 mr-1 whitespace-nowrap">
          Loaded Accounts ({sources.length}):
        </span>
        {sources.map((src) => {
          const isEditing = editingId === src.sourceId;
          return (
            <div
              key={src.sourceId}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
            >
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitEdit(src.sourceId);
                  }}
                  className="inline-flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    autoFocus
                    placeholder="e.g. Groww — Mother"
                    aria-label="Account label"
                    className="h-6 w-36 px-1.5 text-xs font-medium bg-white border border-blue-400 rounded text-slate-900 focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Save account label"
                    className="p-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    aria-label="Cancel rename"
                    className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <>
                  <span className="font-semibold text-slate-900">{src.brokerLabel}</span>
                  <button
                    type="button"
                    onClick={() => startEditing(src)}
                    aria-label={`Rename ${src.brokerLabel}`}
                    title="Rename account (e.g. Mine, Mother, Father)"
                    className="p-0.5 text-slate-400 hover:text-blue-700 rounded transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                  </button>
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
                    title="Remove this account report"
                    className="ml-0.5 p-0.5 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenAddSource}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Source</span>
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
