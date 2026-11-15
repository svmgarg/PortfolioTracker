import React, { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import type { TaxSettings } from '../types/portfolio';

interface SettingsModalProps {
  isOpen: boolean;
  settings: TaxSettings;
  onSave: (updated: TaxSettings) => void;
  onClose: () => void;
}

const MONTH_PRESETS = [12, 24, 36];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onSave,
  onClose,
}) => {
  const [months, setMonths] = useState<number>(settings.holdingPeriodMonths);
  const [debtMonths, setDebtMonths] = useState<number>(
    settings.categoryThresholds.debt_other ?? 24
  );

  useEffect(() => {
    if (isOpen) {
      setMonths(settings.holdingPeriodMonths);
      setDebtMonths(settings.categoryThresholds.debt_other ?? 24);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedMonths = Math.min(120, Math.max(1, Math.round(months || 12)));
    const clampedDebt = Math.min(120, Math.max(1, Math.round(debtMonths || 24)));
    onSave({
      ...settings,
      holdingPeriodMonths: clampedMonths,
      categoryThresholds: {
        equity_etf: clampedMonths,
        debt_other: clampedDebt,
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="settings-modal-title" className="text-base font-bold text-slate-900">
              Holding-Period Classification Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure calendar-month thresholds for Long Term / Short Term classification
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Default Holding-Period Preset (Equity &amp; ETFs)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MONTH_PRESETS.map((preset) => {
                const isSelected = months === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMonths(preset)}
                    className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {preset} Months{preset === 12 ? ' (Default)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="custom-months-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Custom Calendar Months
              </label>
              <input
                id="custom-months-input"
                type="number"
                min={1}
                max={120}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Held &gt; {months || 12} calendar months = Long Term
              </p>
            </div>

            <div>
              <label
                htmlFor="debt-months-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Non-Equity / Debt Category (Months)
              </label>
              <input
                id="debt-months-input"
                type="number"
                min={1}
                max={120}
                value={debtMonths}
                onChange={(e) => setDebtMonths(Number(e.target.value))}
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Reserved for instrument-specific rules
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-3.5 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-blue-900 leading-relaxed">
              Long Term and Short Term labels represent holding-period classifications using true
              calendar-month comparisons (not a fixed 365-day rule). Different Indian securities
              (e.g., debt ETFs, gold ETFs, or unlisted units) may follow distinct tax rules; consult
              your tax advisor before filing.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              Apply Threshold
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
