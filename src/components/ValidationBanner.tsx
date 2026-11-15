import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';

interface ValidationBannerProps {
  warnings: string[];
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({ warnings }) => {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  if (warnings.length === 0 || dismissed) return null;

  return (
    <div
      role="status"
      className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm">
            <span className="font-semibold">
              Data Validation Notice ({warnings.length}{' '}
              {warnings.length === 1 ? 'item' : 'items'})
            </span>
            <span className="text-amber-800 ml-1.5">
              Review reconciliation details from your uploaded workbook.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="p-1 text-amber-800 hover:text-amber-950 rounded cursor-pointer"
            aria-label={expanded ? 'Collapse warnings' : 'Expand warnings'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-amber-800 hover:text-amber-950 rounded cursor-pointer"
            aria-label="Dismiss warnings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="mt-2 ml-6 list-disc space-y-1 text-xs text-amber-800">
          {warnings.map((warning, idx) => (
            <li key={idx}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
