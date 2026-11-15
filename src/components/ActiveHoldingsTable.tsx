import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type {
  ActiveLotComputed,
  ActiveSortField,
  CalendarDate,
  SortDirection,
} from '../types/portfolio';
import {
  formatCalendarDate,
  formatCalendarDateReadable,
  formatNumber,
  formatPercent,
  formatQuantity,
} from '../utils/calculations';

interface ActiveHoldingsTableProps {
  rows: ActiveLotComputed[];
  totalLotsCount: number;
  filteredCount: number;
  valuationDates: CalendarDate[];
  sortField: ActiveSortField;
  sortDirection: SortDirection;
  onSort: (field: ActiveSortField) => void;
  onResetFilters: () => void;
}

interface SortHeaderProps {
  label: string;
  field: ActiveSortField;
  activeField: ActiveSortField;
  direction: SortDirection;
  align?: 'left' | 'right' | 'center';
  onSort: (field: ActiveSortField) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  field,
  activeField,
  direction,
  align = 'left',
  onSort,
}) => {
  const isActive = activeField === field;
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold text-blue-950 whitespace-nowrap select-none ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1.5 ${justify} hover:text-blue-700 transition-colors cursor-pointer`}
      >
        <span>{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
        )}
      </button>
    </th>
  );
};

export const ActiveHoldingsTable: React.FC<ActiveHoldingsTableProps> = ({
  rows,
  totalLotsCount,
  filteredCount,
  valuationDates,
  sortField,
  sortDirection,
  onSort,
  onResetFilters,
}) => {
  const uniqueDateLabels = Array.from(
    new Set(valuationDates.map((d) => formatCalendarDateReadable(d)))
  );
  const valuationLabel =
    uniqueDateLabels.length === 0
      ? '—'
      : uniqueDateLabels.length === 1
      ? uniqueDateLabels[0]
      : uniqueDateLabels.join(' / ');

  return (
    <div>
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Active Purchase Lots ({totalLotsCount} {totalLotsCount === 1 ? 'Lot' : 'Lots'})
          </h2>
          {filteredCount !== totalLotsCount && (
            <span className="text-xs sm:text-sm font-medium text-blue-700 tabular-nums">
              · Showing {filteredCount} matching
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-500 tabular-nums">
          Valuation Date:{' '}
          <span className="font-medium text-slate-700">{valuationLabel}</span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[1000px]">
          <thead className="bg-blue-50 border-b border-blue-200">
            <tr>
              <SortHeader
                label="Script"
                field="script"
                activeField={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortHeader
                label="Source"
                field="source"
                activeField={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortHeader
                label="Buy Date"
                field="buyDate"
                activeField={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortHeader
                label="Quantity"
                field="quantity"
                activeField={sortField}
                direction={sortDirection}
                align="right"
                onSort={onSort}
              />
              <SortHeader
                label="Buy Price (₹)"
                field="buyPrice"
                activeField={sortField}
                direction={sortDirection}
                align="right"
                onSort={onSort}
              />
              <SortHeader
                label="Holding Days"
                field="holdingDays"
                activeField={sortField}
                direction={sortDirection}
                align="right"
                onSort={onSort}
              />
              <SortHeader
                label="Classification"
                field="classification"
                activeField={sortField}
                direction={sortDirection}
                align="center"
                onSort={onSort}
              />
              <SortHeader
                label="Current Value (₹)"
                field="currentValue"
                activeField={sortField}
                direction={sortDirection}
                align="right"
                onSort={onSort}
              />
              <SortHeader
                label="P&L (₹)"
                field="pnl"
                activeField={sortField}
                direction={sortDirection}
                align="right"
                onSort={onSort}
              />
              <SortHeader
                label="P&L (%)"
                field="pnlPercent"
                activeField={sortField}
                direction={sortDirection}
                align="right"
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {totalLotsCount === 0
                      ? 'No active holdings were present in the loaded sources.'
                      : 'No active purchase lots match the current filters.'}
                  </p>
                  {totalLotsCount > 0 && (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="mt-3 inline-flex items-center px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((lot) => {
                const isPositive = lot.unrealisedPnL >= 0;
                const pnlSign = lot.unrealisedPnL > 0 ? '+' : '';
                return (
                  <tr key={lot.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{lot.script}</div>
                      {lot.remark && (
                        <div className="text-xs text-slate-500 mt-0.5">{lot.remark}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {lot.brokerLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs sm:text-sm tabular-nums whitespace-nowrap">
                      {formatCalendarDate(lot.buyDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {formatQuantity(lot.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {formatNumber(lot.buyPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {lot.holdingDays}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-bold border whitespace-nowrap ${
                          lot.classification === 'LT'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {lot.classification === 'LT' ? 'Long Term' : 'Short Term'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium font-mono tabular-nums whitespace-nowrap">
                      {formatNumber(lot.closingValue)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold font-mono tabular-nums whitespace-nowrap ${
                        isPositive ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {pnlSign}
                      {formatNumber(lot.unrealisedPnL)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold font-mono tabular-nums whitespace-nowrap ${
                        isPositive ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(lot.pnlPercent)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
