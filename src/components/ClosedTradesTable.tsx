import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type {
  ClosedSortField,
  ClosedTradeComputed,
  SortDirection,
} from '../types/portfolio';
import {
  formatCalendarDate,
  formatNumber,
  formatPercent,
  formatQuantity,
} from '../utils/calculations';

interface ClosedTradesTableProps {
  rows: ClosedTradeComputed[];
  totalTradesCount: number;
  filteredCount: number;
  sortField: ClosedSortField;
  sortDirection: SortDirection;
  onSort: (field: ClosedSortField) => void;
  onResetFilters: () => void;
}

interface SortHeaderProps {
  label: string;
  field: ClosedSortField;
  activeField: ClosedSortField;
  direction: SortDirection;
  align?: 'left' | 'right' | 'center';
  onSort: (field: ClosedSortField) => void;
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

export const ClosedTradesTable: React.FC<ClosedTradesTableProps> = ({
  rows,
  totalTradesCount,
  filteredCount,
  sortField,
  sortDirection,
  onSort,
  onResetFilters,
}) => {
  return (
    <div>
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Closed Trades ({totalTradesCount} {totalTradesCount === 1 ? 'Trade' : 'Trades'})
          </h2>
          {filteredCount !== totalTradesCount && (
            <span className="text-xs sm:text-sm font-medium text-blue-700 tabular-nums">
              · Showing {filteredCount} matching
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          Realised purchase &amp; sale records
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[1040px]">
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
                label="Buy Date"
                field="buyDate"
                activeField={sortField}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortHeader
                label="Sell Date"
                field="sellDate"
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
                label="Sell Price (₹)"
                field="sellPrice"
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
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold text-blue-950 text-center whitespace-nowrap"
              >
                Classification
              </th>
              <SortHeader
                label="Realised P&L (₹)"
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
                    {totalTradesCount === 0
                      ? 'No realised trades were present in this report.'
                      : 'No closed trades match the current filters.'}
                  </p>
                  {totalTradesCount > 0 && (
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
              rows.map((trade) => {
                const isPositive = trade.realisedPnL >= 0;
                const pnlSign = trade.realisedPnL > 0 ? '+' : '';
                return (
                  <tr
                    key={trade.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{trade.script}</span>
                        {trade.isIntraday && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Intraday
                          </span>
                        )}
                      </div>
                      {trade.remark && !trade.isIntraday && (
                        <div className="text-xs text-slate-500 mt-0.5">{trade.remark}</div>
                      )}
                      {trade.remark && trade.isIntraday && (
                        <div className="text-xs text-slate-500 mt-0.5">{trade.remark}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs sm:text-sm tabular-nums whitespace-nowrap">
                      {formatCalendarDate(trade.buyDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs sm:text-sm tabular-nums whitespace-nowrap">
                      {formatCalendarDate(trade.sellDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {formatQuantity(trade.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {formatNumber(trade.buyPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {formatNumber(trade.sellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-mono tabular-nums whitespace-nowrap">
                      {trade.holdingDays}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center min-w-[38px] px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                          trade.classification === 'LT'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {trade.classification}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold font-mono tabular-nums whitespace-nowrap ${
                        isPositive ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {pnlSign}
                      {formatNumber(trade.realisedPnL)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold font-mono tabular-nums whitespace-nowrap ${
                        isPositive ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(trade.pnlPercent)}
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
