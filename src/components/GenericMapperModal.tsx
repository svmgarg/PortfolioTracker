import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type * as XLSX from 'xlsx';
import {
  type ColumnMappingConfig,
  inspectSheetForMapper,
  type MapperRecordType,
  parseMappedWorkbook,
} from '../parsers/genericMapper';
import type { LoadedSource } from '../types/portfolio';
import { parseDateValue } from '../utils/calculations';

export interface PendingMappingRequest {
  fileName: string;
  contentHash: string;
  workbook: XLSX.WorkBook;
  suggestedBrokerLabel: string;
  reason: string;
}

interface GenericMapperModalProps {
  request: PendingMappingRequest | null;
  onImport: (source: LoadedSource) => void;
  onSkip: () => void;
}

function autoMatchColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const c of candidates) {
    const exact = norm.indexOf(c);
    if (exact !== -1) return exact;
  }
  for (const c of candidates) {
    const partial = norm.findIndex((h) => h.includes(c));
    if (partial !== -1) return partial;
  }
  return -1;
}

export const GenericMapperModal: React.FC<GenericMapperModalProps> = ({
  request,
  onImport,
  onSkip,
}) => {
  const [brokerLabel, setBrokerLabel] = useState('Custom');
  const [sheetName, setSheetName] = useState('');
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [recordType, setRecordType] = useState<MapperRecordType>('active');
  const [valuationDateStr, setValuationDateStr] = useState('14-11-2026');
  const [error, setError] = useState<string | null>(null);

  const [columns, setColumns] = useState<ColumnMappingConfig['columns']>({
    script: -1,
    buyDate: -1,
    quantity: -1,
    buyPrice: -1,
    buyValue: -1,
    closingDate: -1,
    closingPrice: -1,
    closingValue: -1,
    sellDate: -1,
    sellPrice: -1,
    sellValue: -1,
    pnl: -1,
    remark: -1,
  });

  useEffect(() => {
    if (!request) return;
    const firstSheet = request.workbook.SheetNames[0] || '';
    const inspection = inspectSheetForMapper(request.workbook, firstSheet);
    setBrokerLabel(request.suggestedBrokerLabel || 'Custom');
    setSheetName(firstSheet);
    setHeaderRowIndex(inspection.suggestedHeaderRow);
    setError(null);

    const sellCol = autoMatchColumn(inspection.headers, ['selldate', 'exitdate', 'saledate']);
    setRecordType(sellCol !== -1 ? 'closed' : 'active');

    setColumns({
      script: autoMatchColumn(inspection.headers, ['stockname', 'scripname', 'symbol', 'script', 'instrument']),
      buyDate: autoMatchColumn(inspection.headers, ['buydate', 'entrydate', 'purchasedate']),
      quantity: autoMatchColumn(inspection.headers, ['quantity', 'qty', 'units']),
      buyPrice: autoMatchColumn(inspection.headers, ['buyprice', 'entryprice', 'avgprice', 'averageprice']),
      buyValue: autoMatchColumn(inspection.headers, ['buyvalue', 'buyamount', 'investedvalue']),
      closingDate: autoMatchColumn(inspection.headers, ['closingdate', 'valuationdate', 'asondate']),
      closingPrice: autoMatchColumn(inspection.headers, ['closingprice', 'currentprice', 'ltp', 'cmp']),
      closingValue: autoMatchColumn(inspection.headers, ['closingvalue', 'currentvalue', 'marketvalue']),
      sellDate: sellCol,
      sellPrice: autoMatchColumn(inspection.headers, ['sellprice', 'exitprice', 'saleprice']),
      sellValue: autoMatchColumn(inspection.headers, ['sellvalue', 'sellamount', 'salevalue']),
      pnl: autoMatchColumn(inspection.headers, ['unrealisedpnl', 'realisedpnl', 'profit', 'pnl', 'pl']),
      remark: autoMatchColumn(inspection.headers, ['remark', 'remarks', 'note', 'segment']),
    });
  }, [request]);

  const inspection = useMemo(() => {
    if (!request || !sheetName) {
      return { headers: [], sampleRows: [], suggestedHeaderRow: 0 };
    }
    return inspectSheetForMapper(request.workbook, sheetName, headerRowIndex);
  }, [request, sheetName, headerRowIndex]);

  if (!request) return null;

  const handleSheetChange = (nextSheet: string) => {
    setSheetName(nextSheet);
    const nextInsp = inspectSheetForMapper(request.workbook, nextSheet);
    setHeaderRowIndex(nextInsp.suggestedHeaderRow);
  };

  const handleColumnChange = (
    key: keyof ColumnMappingConfig['columns'],
    value: number
  ) => {
    setColumns((prev) => ({ ...prev, [key]: value }));
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (columns.script === -1 || columns.buyDate === -1 || columns.quantity === -1) {
      setError('Please map Script, Buy Date, and Quantity.');
      return;
    }
    if (columns.buyPrice === -1 && columns.buyValue === -1) {
      setError('Please map either Buy Price or Buy Value.');
      return;
    }

    const parsedValDate = parseDateValue(valuationDateStr);
    if (recordType === 'active') {
      if (columns.closingValue === -1 && columns.closingPrice === -1) {
        setError('For Active Holdings, map either Current / Closing Value or Closing Price.');
        return;
      }
      if (!parsedValDate) {
        setError('Please enter a valid Report Valuation Date (DD-MM-YYYY).');
        return;
      }
    } else {
      if (columns.sellDate === -1) {
        setError('For Closed Trades, please map Sell Date.');
        return;
      }
      if (columns.sellPrice === -1 && columns.sellValue === -1) {
        setError('For Closed Trades, please map either Sell Price or Sell Value.');
        return;
      }
    }

    const fallbackValuationDate = parsedValDate ?? { year: 2026, month: 11, day: 14 };

    try {
      const sourceId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const loaded = parseMappedWorkbook(
        request.workbook,
        {
          brokerLabel,
          sheetName,
          headerRowIndex,
          recordType,
          fallbackValuationDate,
          columns,
        },
        sourceId
      );
      onImport({
        ...loaded,
        contentHash: request.contentHash,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse mapped columns.');
    }
  };

  const renderColumnSelect = (
    label: string,
    fieldKey: keyof ColumnMappingConfig['columns'],
    required = false
  ) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <select
        value={columns[fieldKey]}
        onChange={(e) => handleColumnChange(fieldKey, Number(e.target.value))}
        className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={-1}>— Not mapped —</option>
        {inspection.headers.map((header, idx) => (
          <option key={`${idx}-${header}`} value={idx}>
            {header} (Col {idx + 1})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapper-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-3xl my-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 id="mapper-modal-title" className="text-base font-bold text-slate-900">
              Map Columns for Custom Data Source
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{request.reason}</p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Cancel mapping"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleImportSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Label
              </label>
              <input
                type="text"
                value={brokerLabel}
                onChange={(e) => setBrokerLabel(e.target.value)}
                placeholder="e.g. Zerodha"
                className="w-full h-9 px-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Worksheet
              </label>
              <select
                value={sheetName}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="w-full h-9 px-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {request.workbook.SheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Header Row #
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={headerRowIndex + 1}
                onChange={(e) => setHeaderRowIndex(Math.max(0, Number(e.target.value) - 1))}
                className="w-full h-9 px-2.5 text-xs sm:text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Record Type
              </label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as MapperRecordType)}
                className="w-full h-9 px-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active Holdings</option>
                <option value="closed">Closed Trades</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {renderColumnSelect('Script / Stock Name', 'script', true)}
            {renderColumnSelect('Buy Date', 'buyDate', true)}
            {renderColumnSelect('Quantity', 'quantity', true)}
            {renderColumnSelect('Buy Price', 'buyPrice', true)}
            {renderColumnSelect('Buy Value (Optional)', 'buyValue')}

            {recordType === 'active' ? (
              <>
                {renderColumnSelect('Current / Closing Value', 'closingValue', true)}
                {renderColumnSelect('Closing Price (Fallback)', 'closingPrice')}
                {renderColumnSelect('Closing Date (Optional)', 'closingDate')}
                {renderColumnSelect('Unrealised P&L (Optional)', 'pnl')}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valuation Date (DD-MM-YYYY)
                  </label>
                  <input
                    type="text"
                    value={valuationDateStr}
                    onChange={(e) => setValuationDateStr(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
                {renderColumnSelect('Sell Date', 'sellDate', true)}
                {renderColumnSelect('Sell Price', 'sellPrice', true)}
                {renderColumnSelect('Sell Value (Optional)', 'sellValue')}
                {renderColumnSelect('Realised P&L (Optional)', 'pnl')}
              </>
            )}

            {renderColumnSelect('Remark (Optional)', 'remark')}
          </div>

          {inspection.sampleRows.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600 mb-2">
                Preview (First {inspection.sampleRows.length} data rows)
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-blue-50 border-b border-blue-200">
                    <tr>
                      {inspection.headers.map((h, i) => (
                        <th key={i} className="px-2.5 py-1.5 font-semibold text-blue-950 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspection.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 text-slate-700 whitespace-nowrap font-mono">
                            {cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Skip File
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Import Mapped Source
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
