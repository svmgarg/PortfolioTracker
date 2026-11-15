import React from 'react';
import type { ActiveLotComputed } from '../types/portfolio';
import { calculatePnlPercent, formatINR, formatPercent } from '../utils/calculations';

interface SummaryCardsProps {
  filteredActiveLots: ActiveLotComputed[];
  totalActiveCount: number;
  holdingPeriodMonths: number;
  isFiltered: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  filteredActiveLots,
  totalActiveCount,
  holdingPeriodMonths,
  isFiltered,
}) => {
  const portfolioValue = filteredActiveLots.reduce((sum, lot) => sum + lot.closingValue, 0);
  const unrealisedPnL = filteredActiveLots.reduce((sum, lot) => sum + lot.unrealisedPnL, 0);
  const totalBuyValue = filteredActiveLots.reduce((sum, lot) => sum + lot.buyValue, 0);
  const overallPnlPct = calculatePnlPercent(unrealisedPnL, totalBuyValue);

  const ltCount = filteredActiveLots.filter((lot) => lot.classification === 'LT').length;
  const stCount = filteredActiveLots.filter((lot) => lot.classification === 'ST').length;

  const isPositivePnl = unrealisedPnL >= 0;

  return (
    <section aria-label="Portfolio Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Portfolio Value</p>
          {isFiltered && (
            <span className="text-xs font-medium text-blue-700">Filtered</span>
          )}
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
          {formatINR(portfolioValue)}
        </p>
        <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
          {filteredActiveLots.length} of {totalActiveCount} active purchase lots
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Unrealised P&amp;L</p>
          <span
            className={`text-xs font-mono font-semibold tabular-nums ${
              isPositivePnl ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatPercent(overallPnlPct)}
          </span>
        </div>
        <p
          className={`mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight ${
            isPositivePnl ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {formatINR(unrealisedPnL, { showPlus: true })}
        </p>
        <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
          Invested: {formatINR(totalBuyValue)}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Long-Term Lots</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            LT
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums tracking-tight">
          {ltCount}
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Held &gt; {holdingPeriodMonths} calendar months
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Short-Term Lots</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            ST
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums tracking-tight">
          {stCount}
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Held &le; {holdingPeriodMonths} calendar months
        </p>
      </div>
    </section>
  );
};
