import * as XLSX from 'xlsx';
import type {
  ActiveLotRaw,
  CalendarDate,
  ClosedTradeRaw,
  LoadedSource,
  ReportSummary,
  ScripValidationSummary,
} from '../types/portfolio';
import { compareCalendarDates, parseDateValue } from '../utils/calculations';
import {
  type BrokerParser,
  extractMetadataEndDate,
  findColumnIndex,
  isRowEmpty,
  isTotalRow,
  normalizeHeader,
  normalizeText,
  parseNumeric,
  type RawRow,
} from './shared';

function isRealisedHeaderRow(row: RawRow): boolean {
  const norm = row.map(normalizeHeader);
  const hasStock = norm.some((h) => h === 'stockname' || h === 'script' || h === 'symbol');
  const hasSellDate = norm.some((h) => h === 'selldate');
  const hasRealisedPnl = norm.some(
    (h) =>
      h === 'realisedpl' ||
      h === 'realizedpl' ||
      h === 'realisedpnl' ||
      h === 'realizedpnl'
  );
  return hasStock && (hasSellDate || hasRealisedPnl);
}

function isUnrealisedHeaderRow(row: RawRow): boolean {
  const norm = row.map(normalizeHeader);
  const hasStock = norm.some((h) => h === 'stockname' || h === 'script' || h === 'symbol');
  const hasClosingDate = norm.some((h) => h === 'closingdate' || h === 'valuationdate');
  const hasUnrealisedPnl = norm.some(
    (h) =>
      h === 'unrealisedpl' ||
      h === 'unrealizedpl' ||
      h === 'unrealisedpnl' ||
      h === 'unrealizedpnl'
  );
  return hasStock && (hasClosingDate || hasUnrealisedPnl);
}

function isSectionBoundaryRow(row: RawRow): boolean {
  const nonEmpty = row.map(normalizeText).filter(Boolean);
  if (nonEmpty.length === 0) return false;
  const first = nonEmpty[0].toLowerCase();
  if (
    first === 'realised trades' ||
    first === 'realized trades' ||
    first === 'unrealised trades' ||
    first === 'unrealized trades' ||
    first === 'summary' ||
    first === 'charges' ||
    first === 'other charges' ||
    first.startsWith('disclaimer') ||
    first.startsWith('note:')
  ) {
    return true;
  }
  return isRealisedHeaderRow(row) || isUnrealisedHeaderRow(row);
}

function extractReportSummary(rows: RawRow[], tradeHeaderStartRow: number): ReportSummary {
  let realisedPnL: number | null = null;
  let unrealisedPnL: number | null = null;
  let charges: number | null = null;

  const limit = Math.min(rows.length, tradeHeaderStartRow > 0 ? tradeHeaderStartRow : 40);
  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (isRowEmpty(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cellText = normalizeHeader(row[c]);
      if (!cellText) continue;

      const findAdjacentNumeric = (): number | null => {
        for (let k = c + 1; k < Math.min(row.length, c + 6); k++) {
          const val = parseNumeric(row[k]);
          if (val !== null) return val;
        }
        if (r + 1 < limit) {
          const below = parseNumeric(rows[r + 1]?.[c]);
          if (below !== null) return below;
        }
        return null;
      };

      if (
        realisedPnL === null &&
        (cellText === 'realisedpl' ||
          cellText === 'realizedpl' ||
          cellText === 'realisedpnl' ||
          cellText === 'realizedpnl')
      ) {
        realisedPnL = findAdjacentNumeric();
      } else if (
        unrealisedPnL === null &&
        (cellText === 'unrealisedpl' ||
          cellText === 'unrealizedpl' ||
          cellText === 'unrealisedpnl' ||
          cellText === 'unrealizedpnl')
      ) {
        unrealisedPnL = findAdjacentNumeric();
      } else if (
        charges === null &&
        (cellText === 'charges' || cellText === 'totalcharges' || cellText === 'othercharges')
      ) {
        charges = findAdjacentNumeric();
      }
    }
  }

  return { realisedPnL, unrealisedPnL, charges };
}

function parseScripLevelValidation(workbook: XLSX.WorkBook): ScripValidationSummary {
  const scripSheetName = workbook.SheetNames.find((name) =>
    name.trim().toLowerCase().includes('scrip')
  );
  if (!scripSheetName) {
    return {
      found: false,
      totalRealisedPnL: null,
      totalUnrealisedPnL: null,
      scripCount: 0,
    };
  }

  const sheet = workbook.Sheets[scripSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  let headerIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    const norm = (rows[r] || []).map(normalizeHeader);
    if (
      norm.some((h) => h === 'stockname' || h === 'script' || h === 'scripname') &&
      norm.some((h) => h.includes('pnl') || h.endsWith('pl'))
    ) {
      headerIdx = r;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      found: true,
      totalRealisedPnL: null,
      totalUnrealisedPnL: null,
      scripCount: 0,
    };
  }

  const headers = (rows[headerIdx] || []).map(normalizeHeader);
  const stockCol = findColumnIndex(headers, ['stockname', 'script', 'scripname']);
  const realisedCol = findColumnIndex(headers, [
    'realisedpl',
    'realizedpl',
    'realisedpnl',
    'realizedpnl',
  ]);
  const unrealisedCol = findColumnIndex(headers, [
    'unrealisedpl',
    'unrealizedpl',
    'unrealisedpnl',
    'unrealizedpnl',
  ]);

  let sumRealised = 0;
  let sumUnrealised = 0;
  let hasRealised = false;
  let hasUnrealised = false;
  let scripCount = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (isRowEmpty(row)) continue;
    if (isTotalRow(row)) break;

    const stock = stockCol !== -1 ? normalizeText(row[stockCol]) : '';
    if (!stock) continue;
    if (stock.toLowerCase().startsWith('disclaimer')) break;

    scripCount++;
    if (realisedCol !== -1) {
      const val = parseNumeric(row[realisedCol]);
      if (val !== null) {
        sumRealised += val;
        hasRealised = true;
      }
    }
    if (unrealisedCol !== -1) {
      const val = parseNumeric(row[unrealisedCol]);
      if (val !== null) {
        sumUnrealised += val;
        hasUnrealised = true;
      }
    }
  }

  return {
    found: true,
    totalRealisedPnL: hasRealised ? sumRealised : null,
    totalUnrealisedPnL: hasUnrealised ? sumUnrealised : null,
    scripCount,
  };
}

export const growwParser: BrokerParser = {
  brokerType: 'groww',
  displayName: 'Groww',

  canParse(workbook: XLSX.WorkBook): boolean {
    return workbook.SheetNames.some(
      (name) =>
        name.trim().toLowerCase() === 'trade level' ||
        name.trim().toLowerCase().includes('trade level')
    );
  },

  parse(workbook: XLSX.WorkBook, sourceId: string): LoadedSource {
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded workbook does not contain any worksheets.');
    }

    const tradeSheetName = workbook.SheetNames.find(
      (name) =>
        name.trim().toLowerCase() === 'trade level' ||
        name.trim().toLowerCase().includes('trade level')
    );

    if (!tradeSheetName) {
      throw new Error(
        `Groww parser expected a "Trade Level" worksheet, but found: ${workbook.SheetNames.join(
          ', '
        )}.`
      );
    }

    const tradeSheet = workbook.Sheets[tradeSheetName];
    const rows = XLSX.utils.sheet_to_json<RawRow>(tradeSheet, {
      header: 1,
      raw: true,
      defval: null,
    });

    let realisedHeaderRow = -1;
    let unrealisedHeaderRow = -1;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || isRowEmpty(row)) continue;
      if (realisedHeaderRow === -1 && isRealisedHeaderRow(row)) {
        realisedHeaderRow = r;
        continue;
      }
      if (unrealisedHeaderRow === -1 && isUnrealisedHeaderRow(row)) {
        unrealisedHeaderRow = r;
      }
    }

    if (realisedHeaderRow === -1 && unrealisedHeaderRow === -1) {
      throw new Error(
        'Could not locate "Realised trades" or "Unrealised trades" table headers in the Groww "Trade Level" sheet.'
      );
    }

    const warnings: string[] = [];
    const firstTableRow = Math.min(
      realisedHeaderRow === -1 ? Infinity : realisedHeaderRow,
      unrealisedHeaderRow === -1 ? Infinity : unrealisedHeaderRow
    );
    const reportSummary = extractReportSummary(rows, firstTableRow);
    const metadataEndDate = extractMetadataEndDate(rows, firstTableRow);

    const closedTrades: ClosedTradeRaw[] = [];
    const rawActiveWithoutValuation: Array<Omit<ActiveLotRaw, 'sourceValuationDate'>> = [];

    if (realisedHeaderRow !== -1) {
      const headers = (rows[realisedHeaderRow] || []).map(normalizeHeader);
      const col = {
        stock: findColumnIndex(headers, ['stockname', 'script', 'symbol']),
        isin: findColumnIndex(headers, ['isin']),
        qty: findColumnIndex(headers, ['quantity', 'qty']),
        buyDate: findColumnIndex(headers, ['buydate', 'purchasedate']),
        buyPrice: findColumnIndex(headers, ['buyprice', 'purchaseprice']),
        buyValue: findColumnIndex(headers, ['buyvalue', 'purchasevalue']),
        sellDate: findColumnIndex(headers, ['selldate', 'saledate']),
        sellPrice: findColumnIndex(headers, ['sellprice', 'saleprice']),
        sellValue: findColumnIndex(headers, ['sellvalue', 'salevalue']),
        pnl: findColumnIndex(headers, [
          'realisedpl',
          'realizedpl',
          'realisedpnl',
          'realizedpnl',
          'pnl',
          'pl',
        ]),
        remark: findColumnIndex(headers, ['remark', 'remarks', 'note']),
      };

      const missingCols: string[] = [];
      if (col.stock === -1) missingCols.push('Stock name');
      if (col.qty === -1) missingCols.push('Quantity');
      if (col.buyDate === -1) missingCols.push('Buy date');
      if (col.buyPrice === -1) missingCols.push('Buy price');
      if (col.sellDate === -1) missingCols.push('Sell date');
      if (col.sellPrice === -1) missingCols.push('Sell price');
      if (col.pnl === -1) missingCols.push('Realised P&L');

      if (missingCols.length > 0) {
        throw new Error(
          `Missing required columns in Groww Realised trades section: ${missingCols.join(', ')}.`
        );
      }

      for (let r = realisedHeaderRow + 1; r < rows.length; r++) {
        if (r === unrealisedHeaderRow) break;
        const row = rows[r];
        if (isRowEmpty(row)) continue;
        if (isTotalRow(row)) break;
        if (isSectionBoundaryRow(row)) break;

        const script = normalizeText(row[col.stock]);
        if (!script) continue;

        const quantity = parseNumeric(row[col.qty]);
        const buyDate = parseDateValue(row[col.buyDate]);
        const buyPrice = parseNumeric(row[col.buyPrice]);
        const rawBuyValue = col.buyValue !== -1 ? parseNumeric(row[col.buyValue]) : null;
        const sellDate = parseDateValue(row[col.sellDate]);
        const sellPrice = parseNumeric(row[col.sellPrice]);
        const rawSellValue = col.sellValue !== -1 ? parseNumeric(row[col.sellValue]) : null;
        const realisedPnL = parseNumeric(row[col.pnl]);
        const isin = col.isin !== -1 ? normalizeText(row[col.isin]) : '';
        const remark = col.remark !== -1 ? normalizeText(row[col.remark]) : '';

        if (
          quantity === null ||
          buyDate === null ||
          buyPrice === null ||
          sellDate === null ||
          sellPrice === null ||
          realisedPnL === null
        ) {
          warnings.push(
            `Groww closed trade row ${r + 1} (${script}) has missing/invalid date or numeric fields.`
          );
          continue;
        }

        const buyValue = rawBuyValue ?? quantity * buyPrice;
        const sellValue = rawSellValue ?? quantity * sellPrice;
        const isIntraday = remark.toLowerCase().includes('intraday');

        closedTrades.push({
          id: `${sourceId}-closed-${r + 1}`,
          sourceId,
          brokerLabel: 'Groww',
          rowNumber: r + 1,
          script,
          isin,
          quantity,
          buyDate,
          buyPrice,
          buyValue,
          sellDate,
          sellPrice,
          sellValue,
          realisedPnL,
          remark,
          isIntraday,
        });
      }
    }

    if (unrealisedHeaderRow !== -1) {
      const headers = (rows[unrealisedHeaderRow] || []).map(normalizeHeader);
      const col = {
        stock: findColumnIndex(headers, ['stockname', 'script', 'symbol']),
        isin: findColumnIndex(headers, ['isin']),
        qty: findColumnIndex(headers, ['quantity', 'qty']),
        buyDate: findColumnIndex(headers, ['buydate', 'purchasedate']),
        buyPrice: findColumnIndex(headers, ['buyprice', 'purchaseprice']),
        buyValue: findColumnIndex(headers, ['buyvalue', 'purchasevalue']),
        closingDate: findColumnIndex(headers, ['closingdate', 'valuationdate']),
        closingPrice: findColumnIndex(headers, ['closingprice', 'ltp']),
        closingValue: findColumnIndex(headers, ['closingvalue', 'currentvalue', 'marketvalue']),
        pnl: findColumnIndex(headers, [
          'unrealisedpl',
          'unrealizedpl',
          'unrealisedpnl',
          'unrealizedpnl',
          'pnl',
          'pl',
        ]),
        remark: findColumnIndex(headers, ['remark', 'remarks', 'note']),
      };

      const missingCols: string[] = [];
      if (col.stock === -1) missingCols.push('Stock name');
      if (col.qty === -1) missingCols.push('Quantity');
      if (col.buyDate === -1) missingCols.push('Buy date');
      if (col.buyPrice === -1) missingCols.push('Buy price');
      if (col.closingValue === -1 && col.closingPrice === -1) missingCols.push('Closing value');
      if (col.pnl === -1) missingCols.push('Unrealised P&L');

      if (missingCols.length > 0) {
        throw new Error(
          `Missing required columns in Groww Unrealised trades section: ${missingCols.join(', ')}.`
        );
      }

      for (let r = unrealisedHeaderRow + 1; r < rows.length; r++) {
        if (r === realisedHeaderRow) break;
        const row = rows[r];
        if (isRowEmpty(row)) continue;
        if (isTotalRow(row)) break;
        if (isSectionBoundaryRow(row)) break;

        const script = normalizeText(row[col.stock]);
        if (!script) continue;

        const quantity = parseNumeric(row[col.qty]);
        const buyDate = parseDateValue(row[col.buyDate]);
        const buyPrice = parseNumeric(row[col.buyPrice]);
        const rawBuyValue = col.buyValue !== -1 ? parseNumeric(row[col.buyValue]) : null;
        const closingDate = col.closingDate !== -1 ? parseDateValue(row[col.closingDate]) : null;
        const closingPrice = col.closingPrice !== -1 ? parseNumeric(row[col.closingPrice]) : null;
        const rawClosingValue =
          col.closingValue !== -1 ? parseNumeric(row[col.closingValue]) : null;
        const unrealisedPnL = parseNumeric(row[col.pnl]);
        const isin = col.isin !== -1 ? normalizeText(row[col.isin]) : '';
        const remark = col.remark !== -1 ? normalizeText(row[col.remark]) : '';

        if (
          quantity === null ||
          buyDate === null ||
          buyPrice === null ||
          unrealisedPnL === null ||
          (rawClosingValue === null && closingPrice === null)
        ) {
          warnings.push(
            `Groww active holding row ${r + 1} (${script}) has missing/invalid date or numeric fields.`
          );
          continue;
        }

        if (col.closingDate !== -1 && closingDate === null) {
          warnings.push(
            `Groww active holding row ${r + 1} (${script}) is missing a Closing date; using report valuation date.`
          );
        }

        const buyValue = rawBuyValue ?? quantity * buyPrice;
        const closingValue = rawClosingValue ?? quantity * (closingPrice ?? 0);
        const effectiveClosingPrice =
          closingPrice ?? (quantity > 0 ? closingValue / quantity : 0);

        rawActiveWithoutValuation.push({
          id: `${sourceId}-active-${r + 1}`,
          sourceId,
          brokerLabel: 'Groww',
          rowNumber: r + 1,
          script,
          isin,
          quantity,
          buyDate,
          buyPrice,
          buyValue,
          closingDate,
          closingPrice: effectiveClosingPrice,
          closingValue,
          unrealisedPnL,
          remark,
        });
      }
    }

    if (rawActiveWithoutValuation.length === 0 && closedTrades.length === 0) {
      throw new Error(
        'No valid Active Holdings or Closed Trades records were found in the Groww "Trade Level" sheet.'
      );
    }

    let valuationDate: CalendarDate | null = null;
    for (const lot of rawActiveWithoutValuation) {
      if (
        lot.closingDate &&
        (!valuationDate || compareCalendarDates(lot.closingDate, valuationDate) > 0)
      ) {
        valuationDate = lot.closingDate;
      }
    }
    if (!valuationDate && metadataEndDate) {
      valuationDate = metadataEndDate;
    }
    if (!valuationDate) {
      for (const trade of closedTrades) {
        if (!valuationDate || compareCalendarDates(trade.sellDate, valuationDate) > 0) {
          valuationDate = trade.sellDate;
        }
      }
    }
    if (!valuationDate) {
      throw new Error('Unable to determine the Report Valuation Date from the Groww workbook.');
    }

    const activeLots: ActiveLotRaw[] = rawActiveWithoutValuation.map((lot) => ({
      ...lot,
      sourceValuationDate: valuationDate,
    }));

    const sumActivePnL = activeLots.reduce((acc, lot) => acc + lot.unrealisedPnL, 0);
    const sumClosedPnL = closedTrades.reduce((acc, t) => acc + t.realisedPnL, 0);

    if (
      reportSummary.unrealisedPnL !== null &&
      Math.abs(sumActivePnL - reportSummary.unrealisedPnL) > 0.5
    ) {
      warnings.push(
        `Groww Unrealised P&L reconciliation difference: sum of ${activeLots.length} active lots is ₹${sumActivePnL.toFixed(
          2
        )}, whereas Summary states ₹${reportSummary.unrealisedPnL.toFixed(2)}.`
      );
    }

    if (
      reportSummary.realisedPnL !== null &&
      Math.abs(sumClosedPnL - reportSummary.realisedPnL) > 0.5
    ) {
      warnings.push(
        `Groww Realised P&L reconciliation difference: sum of ${closedTrades.length} closed trades is ₹${sumClosedPnL.toFixed(
          2
        )}, whereas Summary states ₹${reportSummary.realisedPnL.toFixed(2)}.`
      );
    }

    for (const lot of activeLots) {
      const expectedPnl = lot.closingValue - lot.buyValue;
      if (Math.abs(expectedPnl - lot.unrealisedPnL) > 1.0) {
        warnings.push(
          `Groww lot value check for ${lot.script} (row ${lot.rowNumber}): Closing Value - Buy Value = ₹${expectedPnl.toFixed(
            2
          )}, whereas report Unrealised P&L = ₹${lot.unrealisedPnL.toFixed(2)}.`
        );
      }
    }

    const scripValidation = parseScripLevelValidation(workbook);
    if (scripValidation.found) {
      if (
        scripValidation.totalUnrealisedPnL !== null &&
        Math.abs(sumActivePnL - scripValidation.totalUnrealisedPnL) > 1.0
      ) {
        warnings.push(
          `Groww cross-check with Scrip Level sheet: Trade Level active P&L (₹${sumActivePnL.toFixed(
            2
          )}) differs from Scrip Level total (₹${scripValidation.totalUnrealisedPnL.toFixed(2)}).`
        );
      }
      if (
        scripValidation.totalRealisedPnL !== null &&
        Math.abs(sumClosedPnL - scripValidation.totalRealisedPnL) > 1.0
      ) {
        warnings.push(
          `Groww cross-check with Scrip Level sheet: Trade Level realised P&L (₹${sumClosedPnL.toFixed(
            2
          )}) differs from Scrip Level total (₹${scripValidation.totalRealisedPnL.toFixed(2)}).`
        );
      }
    }

    return {
      sourceId,
      brokerType: 'groww',
      brokerLabel: 'Groww',
      valuationDate,
      reportSummary,
      scripValidation,
      activeLots,
      closedTrades,
      warnings,
    };
  },
};
