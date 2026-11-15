import * as XLSX from 'xlsx';
import type { ActiveLotRaw, CalendarDate, ClosedTradeRaw, LoadedSource } from '../types/portfolio';
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
  ParserTemplateMismatchError,
  type RawRow,
} from './shared';

/**
 * Baseline Zerodha Console Tax P&L / Holdings parser.
 * Isolated module ready for exact field refinement once a real Zerodha workbook is supplied.
 */
export const zerodhaParser: BrokerParser = {
  brokerType: 'zerodha',
  displayName: 'Zerodha',

  canParse(workbook: XLSX.WorkBook): boolean {
    const names = workbook.SheetNames.map((n) => n.trim().toLowerCase());
    return names.some(
      (n) =>
        n.includes('tradewise') ||
        n.includes('zerodha') ||
        (names.includes('equity') && names.some((m) => m.includes('exit') || m.includes('pnl')))
    );
  },

  parse(workbook: XLSX.WorkBook, sourceId: string): LoadedSource {
    const sheetNames = workbook.SheetNames;
    const tradewiseSheetName = sheetNames.find((n) => {
      const lower = n.trim().toLowerCase();
      return lower.includes('tradewise') || lower.includes('exits');
    });
    const holdingsSheetName = sheetNames.find((n) =>
      n.trim().toLowerCase().includes('holding')
    );

    if (!tradewiseSheetName && !holdingsSheetName) {
      throw new ParserTemplateMismatchError(
        `Zerodha parser expected a "Tradewise" / "Tradewise Exits" or "Holdings" sheet, but found: ${sheetNames.join(
          ', '
        )}. You can map columns manually instead.`,
        'zerodha'
      );
    }

    const warnings: string[] = [];
    const closedTrades: ClosedTradeRaw[] = [];
    const rawActiveWithoutValuation: Array<Omit<ActiveLotRaw, 'sourceValuationDate'>> = [];
    let metadataDate: CalendarDate | null = null;

    if (tradewiseSheetName) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[tradewiseSheetName], {
        header: 1,
        raw: true,
        defval: null,
      });

      let headerRow = -1;
      for (let r = 0; r < rows.length; r++) {
        const norm = (rows[r] || []).map(normalizeHeader);
        const hasSymbol = norm.some(
          (h) => h === 'symbol' || h === 'scripname' || h === 'stockname' || h === 'instrument'
        );
        const hasDates = norm.some(
          (h) => h.includes('buydate') || h.includes('entrydate') || h.includes('acquisitiondate')
        );
        if (hasSymbol && hasDates) {
          headerRow = r;
          break;
        }
      }

      if (headerRow === -1) {
        throw new ParserTemplateMismatchError(
          `Could not locate Zerodha Tradewise column headers in "${tradewiseSheetName}". Use the column mapper or provide a sample Zerodha report to refine this parser.`,
          'zerodha'
        );
      }

      metadataDate = extractMetadataEndDate(rows, headerRow);
      const headers = (rows[headerRow] || []).map(normalizeHeader);

      const col = {
        script: findColumnIndex(headers, ['symbol', 'scripname', 'stockname', 'instrument']),
        isin: findColumnIndex(headers, ['isin']),
        qty: findColumnIndex(headers, ['quantity', 'qty']),
        buyDate: findColumnIndex(headers, ['entrydate', 'buydate', 'dateofacquisition']),
        buyPrice: findColumnIndex(headers, ['buyprice', 'entryprice', 'acquisitionprice']),
        buyValue: findColumnIndex(headers, ['buyvalue', 'costofacquisition', 'buyamount']),
        sellDate: findColumnIndex(headers, ['exitdate', 'selldate', 'dateoftransfer']),
        sellPrice: findColumnIndex(headers, ['sellprice', 'exitprice', 'saleprice']),
        sellValue: findColumnIndex(headers, ['sellvalue', 'salevalue', 'grossproceeds']),
        pnl: findColumnIndex(headers, ['profit', 'realisedpnl', 'realizedpnl', 'realisedpl', 'pnl']),
        remark: findColumnIndex(headers, ['remark', 'remarks', 'segment', 'assetclass']),
      };

      const missing: string[] = [];
      if (col.script === -1) missing.push('Symbol / Scrip Name');
      if (col.qty === -1) missing.push('Quantity');
      if (col.buyDate === -1) missing.push('Entry / Buy Date');
      if (col.sellDate === -1) missing.push('Exit / Sell Date');
      if (col.pnl === -1) missing.push('Profit / Realised P&L');

      if (missing.length > 0) {
        throw new ParserTemplateMismatchError(
          `Zerodha "${tradewiseSheetName}" is missing expected columns (${missing.join(
            ', '
          )}). You can map columns manually below.`,
          'zerodha'
        );
      }

      for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowEmpty(row)) continue;
        if (isTotalRow(row)) break;

        const script = normalizeText(row[col.script]);
        if (!script) continue;

        const quantity = parseNumeric(row[col.qty]);
        const buyDate = parseDateValue(row[col.buyDate]);
        const sellDate = parseDateValue(row[col.sellDate]);
        const rawBuyPrice = col.buyPrice !== -1 ? parseNumeric(row[col.buyPrice]) : null;
        const rawBuyValue = col.buyValue !== -1 ? parseNumeric(row[col.buyValue]) : null;
        const rawSellPrice = col.sellPrice !== -1 ? parseNumeric(row[col.sellPrice]) : null;
        const rawSellValue = col.sellValue !== -1 ? parseNumeric(row[col.sellValue]) : null;
        const realisedPnL = parseNumeric(row[col.pnl]);

        if (quantity === null || buyDate === null || sellDate === null || realisedPnL === null) {
          warnings.push(
            `Zerodha trade row ${r + 1} (${script}) has missing/invalid date or numeric fields.`
          );
          continue;
        }

        const buyValue =
          rawBuyValue ?? (rawBuyPrice !== null ? quantity * rawBuyPrice : 0);
        const buyPrice =
          rawBuyPrice ?? (quantity > 0 ? buyValue / quantity : 0);
        const sellValue =
          rawSellValue ?? (rawSellPrice !== null ? quantity * rawSellPrice : buyValue + realisedPnL);
        const sellPrice =
          rawSellPrice ?? (quantity > 0 ? sellValue / quantity : 0);

        const remark = col.remark !== -1 ? normalizeText(row[col.remark]) : '';
        const isin = col.isin !== -1 ? normalizeText(row[col.isin]) : '';
        const isIntraday =
          remark.toLowerCase().includes('intraday') ||
          compareCalendarDates(buyDate, sellDate) === 0;

        closedTrades.push({
          id: `${sourceId}-closed-${r + 1}`,
          sourceId,
          brokerLabel: 'Zerodha',
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

    if (holdingsSheetName) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[holdingsSheetName], {
        header: 1,
        raw: true,
        defval: null,
      });

      let headerRow = -1;
      for (let r = 0; r < rows.length; r++) {
        const norm = (rows[r] || []).map(normalizeHeader);
        if (
          norm.some((h) => h === 'symbol' || h === 'instrument' || h === 'stockname') &&
          norm.some((h) => h.includes('buydate') || h.includes('date'))
        ) {
          headerRow = r;
          break;
        }
      }

      if (headerRow !== -1) {
        if (!metadataDate) metadataDate = extractMetadataEndDate(rows, headerRow);
        const headers = (rows[headerRow] || []).map(normalizeHeader);
        const col = {
          script: findColumnIndex(headers, ['symbol', 'instrument', 'stockname', 'scripname']),
          isin: findColumnIndex(headers, ['isin']),
          qty: findColumnIndex(headers, ['quantity', 'qty', 'quantityavailable']),
          buyDate: findColumnIndex(headers, ['buydate', 'entrydate', 'purchasedate']),
          buyPrice: findColumnIndex(headers, ['buyprice', 'averageprice', 'avgprice']),
          buyValue: findColumnIndex(headers, ['buyvalue', 'investedvalue']),
          closingDate: findColumnIndex(headers, ['closingdate', 'valuationdate', 'asondate']),
          closingPrice: findColumnIndex(headers, ['closingprice', 'ltp', 'lastprice', 'cmp']),
          closingValue: findColumnIndex(headers, ['closingvalue', 'currentvalue', 'presentvalue']),
          pnl: findColumnIndex(headers, ['unrealisedpnl', 'unrealizedpnl', 'pnl', 'pl']),
          remark: findColumnIndex(headers, ['remark', 'remarks']),
        };

        if (col.script !== -1 && col.qty !== -1 && col.buyDate !== -1) {
          for (let r = headerRow + 1; r < rows.length; r++) {
            const row = rows[r];
            if (isRowEmpty(row)) continue;
            if (isTotalRow(row)) break;

            const script = normalizeText(row[col.script]);
            if (!script) continue;

            const quantity = parseNumeric(row[col.qty]);
            const buyDate = parseDateValue(row[col.buyDate]);
            const buyPrice = col.buyPrice !== -1 ? parseNumeric(row[col.buyPrice]) : null;
            const rawBuyValue = col.buyValue !== -1 ? parseNumeric(row[col.buyValue]) : null;
            const closingDate =
              col.closingDate !== -1 ? parseDateValue(row[col.closingDate]) : null;
            const closingPrice =
              col.closingPrice !== -1 ? parseNumeric(row[col.closingPrice]) : null;
            const rawClosingValue =
              col.closingValue !== -1 ? parseNumeric(row[col.closingValue]) : null;
            const rawPnl = col.pnl !== -1 ? parseNumeric(row[col.pnl]) : null;

            if (quantity === null || buyDate === null || (buyPrice === null && rawBuyValue === null)) {
              warnings.push(
                `Zerodha holding row ${r + 1} (${script}) has missing/invalid buy date or price fields.`
              );
              continue;
            }

            const buyValue = rawBuyValue ?? quantity * (buyPrice ?? 0);
            const effBuyPrice = buyPrice ?? (quantity > 0 ? buyValue / quantity : 0);
            const closingValue =
              rawClosingValue ??
              (closingPrice !== null ? quantity * closingPrice : buyValue + (rawPnl ?? 0));
            const effClosingPrice =
              closingPrice ?? (quantity > 0 ? closingValue / quantity : 0);
            const unrealisedPnL = rawPnl ?? closingValue - buyValue;

            rawActiveWithoutValuation.push({
              id: `${sourceId}-active-${r + 1}`,
              sourceId,
              brokerLabel: 'Zerodha',
              rowNumber: r + 1,
              script,
              isin: col.isin !== -1 ? normalizeText(row[col.isin]) : '',
              quantity,
              buyDate,
              buyPrice: effBuyPrice,
              buyValue,
              closingDate,
              closingPrice: effClosingPrice,
              closingValue,
              unrealisedPnL,
              remark: col.remark !== -1 ? normalizeText(row[col.remark]) : '',
            });
          }
        } else {
          warnings.push(
            `Zerodha "${holdingsSheetName}" does not contain per-lot Buy Date columns; active holdings require lot-level buy dates.`
          );
        }
      }
    }

    if (rawActiveWithoutValuation.length === 0 && closedTrades.length === 0) {
      throw new ParserTemplateMismatchError(
        'No lot-level records matched the baseline Zerodha template. You can use the Column Mapper to import this file.',
        'zerodha'
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
    if (!valuationDate && metadataDate) valuationDate = metadataDate;
    if (!valuationDate) {
      for (const t of closedTrades) {
        if (!valuationDate || compareCalendarDates(t.sellDate, valuationDate) > 0) {
          valuationDate = t.sellDate;
        }
      }
    }
    if (!valuationDate) {
      throw new ParserTemplateMismatchError(
        'Could not determine the report valuation date from the Zerodha workbook.',
        'zerodha'
      );
    }

    const activeLots: ActiveLotRaw[] = rawActiveWithoutValuation.map((lot) => ({
      ...lot,
      sourceValuationDate: valuationDate,
    }));

    return {
      sourceId,
      brokerType: 'zerodha',
      brokerLabel: 'Zerodha',
      valuationDate,
      reportSummary: {
        realisedPnL: closedTrades.reduce((acc, t) => acc + t.realisedPnL, 0),
        unrealisedPnL: activeLots.reduce((acc, l) => acc + l.unrealisedPnL, 0),
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
  },
};
