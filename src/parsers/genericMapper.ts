import * as XLSX from 'xlsx';
import type { ActiveLotRaw, CalendarDate, ClosedTradeRaw, LoadedSource } from '../types/portfolio';
import { compareCalendarDates, parseDateValue } from '../utils/calculations';
import { isRowEmpty, isTotalRow, normalizeText, parseNumeric, type RawRow } from './shared';

export type MapperRecordType = 'active' | 'closed';

export interface ColumnMappingConfig {
  brokerLabel: string;
  sheetName: string;
  headerRowIndex: number;
  recordType: MapperRecordType;
  fallbackValuationDate: CalendarDate;
  columns: {
    script: number;
    buyDate: number;
    quantity: number;
    buyPrice: number;
    buyValue: number; // optional (-1 if unused)
    closingDate: number; // optional for active
    closingPrice: number; // optional if closingValue mapped
    closingValue: number; // optional if closingPrice mapped
    sellDate: number; // required for closed
    sellPrice: number; // required for closed (or sellValue)
    sellValue: number; // optional for closed
    pnl: number; // optional (computed if missing)
    remark: number; // optional
  };
}

export interface SheetInspection {
  headers: string[];
  sampleRows: string[][];
  suggestedHeaderRow: number;
}

export function inspectSheetForMapper(
  workbook: XLSX.WorkBook,
  sheetName: string,
  explicitHeaderRow?: number
): SheetInspection {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { headers: [], sampleRows: [], suggestedHeaderRow: 0 };
  }

  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  let headerIdx = explicitHeaderRow ?? -1;
  if (headerIdx === -1) {
    // Pick the first row with >= 3 non-empty string cells as default header row
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const row = rows[r] || [];
      const nonEmptyStrings = row.filter(
        (c) => typeof c === 'string' && c.trim().length > 0
      );
      if (nonEmptyStrings.length >= 3) {
        headerIdx = r;
        break;
      }
    }
    if (headerIdx === -1) headerIdx = 0;
  }

  const rawHeaders = rows[headerIdx] || [];
  const maxCols = Math.max(
    rawHeaders.length,
    ...rows.slice(headerIdx + 1, headerIdx + 6).map((r) => (r || []).length),
    0
  );

  const headers: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const label = normalizeText(rawHeaders[c]);
    headers.push(label || `Column ${c + 1}`);
  }

  const sampleRows: string[][] = [];
  for (let r = headerIdx + 1; r < rows.length && sampleRows.length < 3; r++) {
    const row = rows[r];
    if (isRowEmpty(row)) continue;
    sampleRows.push(headers.map((_, idx) => normalizeText(row[idx])));
  }

  return {
    headers,
    sampleRows,
    suggestedHeaderRow: headerIdx,
  };
}

export function parseMappedWorkbook(
  workbook: XLSX.WorkBook,
  config: ColumnMappingConfig,
  sourceId: string
): LoadedSource {
  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) {
    throw new Error(`Worksheet "${config.sheetName}" was not found.`);
  }

  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  const brokerLabel = config.brokerLabel.trim() || 'Custom';
  const warnings: string[] = [];
  const activeRawWithoutValuation: Array<Omit<ActiveLotRaw, 'sourceValuationDate'>> = [];
  const closedTrades: ClosedTradeRaw[] = [];
  const { columns } = config;

  for (let r = config.headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (isRowEmpty(row)) continue;
    if (isTotalRow(row)) break;

    const script = columns.script !== -1 ? normalizeText(row[columns.script]) : '';
    if (!script) continue;

    const quantity = columns.quantity !== -1 ? parseNumeric(row[columns.quantity]) : null;
    const buyDate = columns.buyDate !== -1 ? parseDateValue(row[columns.buyDate]) : null;
    const buyPrice = columns.buyPrice !== -1 ? parseNumeric(row[columns.buyPrice]) : null;
    const rawBuyValue = columns.buyValue !== -1 ? parseNumeric(row[columns.buyValue]) : null;
    const remark = columns.remark !== -1 ? normalizeText(row[columns.remark]) : '';

    if (quantity === null || buyDate === null || (buyPrice === null && rawBuyValue === null)) {
      warnings.push(
        `${brokerLabel} row ${r + 1} (${script}) skipped due to missing/invalid quantity, buy date, or buy price.`
      );
      continue;
    }

    const buyValue = rawBuyValue ?? quantity * (buyPrice ?? 0);
    const effBuyPrice = buyPrice ?? (quantity > 0 ? buyValue / quantity : 0);

    if (config.recordType === 'active') {
      const closingDate =
        columns.closingDate !== -1 ? parseDateValue(row[columns.closingDate]) : null;
      const closingPrice =
        columns.closingPrice !== -1 ? parseNumeric(row[columns.closingPrice]) : null;
      const rawClosingValue =
        columns.closingValue !== -1 ? parseNumeric(row[columns.closingValue]) : null;
      const rawPnl = columns.pnl !== -1 ? parseNumeric(row[columns.pnl]) : null;

      if (rawClosingValue === null && closingPrice === null) {
        warnings.push(
          `${brokerLabel} row ${r + 1} (${script}) skipped because both closing value and closing price are missing.`
        );
        continue;
      }

      const closingValue = rawClosingValue ?? quantity * (closingPrice ?? 0);
      const effClosingPrice =
        closingPrice ?? (quantity > 0 ? closingValue / quantity : 0);
      const unrealisedPnL = rawPnl ?? closingValue - buyValue;

      activeRawWithoutValuation.push({
        id: `${sourceId}-active-${r + 1}`,
        sourceId,
        brokerLabel,
        rowNumber: r + 1,
        script,
        isin: '',
        quantity,
        buyDate,
        buyPrice: effBuyPrice,
        buyValue,
        closingDate,
        closingPrice: effClosingPrice,
        closingValue,
        unrealisedPnL,
        remark,
      });
    } else {
      const sellDate = columns.sellDate !== -1 ? parseDateValue(row[columns.sellDate]) : null;
      const sellPrice =
        columns.sellPrice !== -1 ? parseNumeric(row[columns.sellPrice]) : null;
      const rawSellValue =
        columns.sellValue !== -1 ? parseNumeric(row[columns.sellValue]) : null;
      const rawPnl = columns.pnl !== -1 ? parseNumeric(row[columns.pnl]) : null;

      if (sellDate === null || (sellPrice === null && rawSellValue === null)) {
        warnings.push(
          `${brokerLabel} row ${r + 1} (${script}) skipped due to missing/invalid sell date or sell price.`
        );
        continue;
      }

      const sellValue = rawSellValue ?? quantity * (sellPrice ?? 0);
      const effSellPrice = sellPrice ?? (quantity > 0 ? sellValue / quantity : 0);
      const realisedPnL = rawPnl ?? sellValue - buyValue;

      closedTrades.push({
        id: `${sourceId}-closed-${r + 1}`,
        sourceId,
        brokerLabel,
        rowNumber: r + 1,
        script,
        isin: '',
        quantity,
        buyDate,
        buyPrice: effBuyPrice,
        buyValue,
        sellDate,
        sellPrice: effSellPrice,
        sellValue,
        realisedPnL,
        remark,
        isIntraday:
          remark.toLowerCase().includes('intraday') ||
          compareCalendarDates(buyDate, sellDate) === 0,
      });
    }
  }

  if (activeRawWithoutValuation.length === 0 && closedTrades.length === 0) {
    throw new Error(
      'No valid transaction rows could be imported using the selected column mappings.'
    );
  }

  let valuationDate: CalendarDate = config.fallbackValuationDate;
  for (const lot of activeRawWithoutValuation) {
    if (lot.closingDate && compareCalendarDates(lot.closingDate, valuationDate) > 0) {
      valuationDate = lot.closingDate;
    }
  }

  const activeLots: ActiveLotRaw[] = activeRawWithoutValuation.map((lot) => ({
    ...lot,
    sourceValuationDate: valuationDate,
  }));

  return {
    sourceId,
    brokerType: 'custom',
    brokerLabel,
    valuationDate,
    reportSummary: {
      realisedPnL: closedTrades.reduce((sum, t) => sum + t.realisedPnL, 0),
      unrealisedPnL: activeLots.reduce((sum, l) => sum + l.unrealisedPnL, 0),
      charges: null,
    },
    scripValidation: {
      found: false,
      totalRealisedPnL: null,
      totalUnrealisedPnL: null,
      scripCount: 0,
    },
    activeLots,
    closedTrades,
    warnings,
  };
}
