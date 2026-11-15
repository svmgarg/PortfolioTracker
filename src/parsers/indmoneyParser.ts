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
 * Baseline INDmoney Stocks P&L parser.
 * Isolated module ready for exact field refinement once a real INDmoney export is supplied.
 */
export const indmoneyParser: BrokerParser = {
  brokerType: 'indmoney',
  displayName: 'INDmoney',

  canParse(workbook: XLSX.WorkBook): boolean {
    const names = workbook.SheetNames.map((n) => n.trim().toLowerCase());
    if (names.some((n) => n.includes('indmoney') || n.includes('indstocks'))) {
      return true;
    }
    for (const sheetName of workbook.SheetNames.slice(0, 3)) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: null,
      });
      const topText = rows
        .slice(0, 8)
        .flat()
        .map(normalizeText)
        .join(' ')
        .toLowerCase();
      if (topText.includes('indmoney') || topText.includes('indstocks')) {
        return true;
      }
    }
    return false;
  },

  parse(workbook: XLSX.WorkBook, sourceId: string): LoadedSource {
    const warnings: string[] = [];
    const closedTrades: ClosedTradeRaw[] = [];
    const rawActiveWithoutValuation: Array<Omit<ActiveLotRaw, 'sourceValuationDate'>> = [];
    let metadataDate: CalendarDate | null = null;

    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: null,
      });

      let headerRow = -1;
      for (let r = 0; r < rows.length; r++) {
        const norm = (rows[r] || []).map(normalizeHeader);
        const hasStock = norm.some(
          (h) => h === 'scripname' || h === 'stockname' || h === 'symbol' || h === 'script'
        );
        const hasBuyDate = norm.some((h) => h === 'buydate' || h === 'purchasedate');
        if (hasStock && hasBuyDate) {
          headerRow = r;
          break;
        }
      }

      if (headerRow === -1) continue;
      if (!metadataDate) metadataDate = extractMetadataEndDate(rows, headerRow);

      const headers = (rows[headerRow] || []).map(normalizeHeader);
      const col = {
        script: findColumnIndex(headers, ['scripname', 'stockname', 'symbol', 'script']),
        isin: findColumnIndex(headers, ['isin']),
        qty: findColumnIndex(headers, ['quantity', 'buyquantity', 'sellquantity', 'qty']),
        buyDate: findColumnIndex(headers, ['buydate', 'purchasedate']),
        buyPrice: findColumnIndex(headers, ['buyprice', 'avgbuyprice', 'averagebuyprice']),
        buyValue: findColumnIndex(headers, ['buyamount', 'buyvalue', 'investedvalue']),
        sellDate: findColumnIndex(headers, ['selldate', 'saledate']),
        sellPrice: findColumnIndex(headers, ['sellprice', 'saleprice']),
        sellValue: findColumnIndex(headers, ['sellamount', 'sellvalue']),
        realisedPnl: findColumnIndex(headers, [
          'realizedprofitloss',
          'realisedprofitloss',
          'realizedpnl',
          'realisedpnl',
          'realizedpl',
          'realisedpl',
        ]),
        currentPrice: findColumnIndex(headers, ['currentprice', 'marketprice', 'closingprice', 'ltp']),
        currentValue: findColumnIndex(headers, ['currentvalue', 'closingvalue', 'marketvalue']),
        unrealisedPnl: findColumnIndex(headers, [
          'unrealizedprofitloss',
          'unrealisedprofitloss',
          'unrealizedpnl',
          'unrealisedpnl',
          'unrealizedpl',
          'unrealisedpl',
        ]),
        closingDate: findColumnIndex(headers, ['closingdate', 'asondate', 'valuationdate']),
        remark: findColumnIndex(headers, ['remark', 'remarks', 'tradetype']),
      };

      const isClosedSheet = col.sellDate !== -1;
      const isActiveSheet = !isClosedSheet && (col.currentValue !== -1 || col.currentPrice !== -1);

      if (!isClosedSheet && !isActiveSheet) continue;

      for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        if (isRowEmpty(row)) continue;
        if (isTotalRow(row)) break;

        const script = col.script !== -1 ? normalizeText(row[col.script]) : '';
        if (!script) continue;

        const quantity = col.qty !== -1 ? parseNumeric(row[col.qty]) : null;
        const buyDate = col.buyDate !== -1 ? parseDateValue(row[col.buyDate]) : null;
        const buyPrice = col.buyPrice !== -1 ? parseNumeric(row[col.buyPrice]) : null;
        const rawBuyValue = col.buyValue !== -1 ? parseNumeric(row[col.buyValue]) : null;
        const isin = col.isin !== -1 ? normalizeText(row[col.isin]) : '';
        const remark = col.remark !== -1 ? normalizeText(row[col.remark]) : '';

        if (quantity === null || buyDate === null || (buyPrice === null && rawBuyValue === null)) {
          warnings.push(
            `INDmoney row ${r + 1} (${script}) has missing/invalid buy date or price fields.`
          );
          continue;
        }

        const buyValue = rawBuyValue ?? quantity * (buyPrice ?? 0);
        const effBuyPrice = buyPrice ?? (quantity > 0 ? buyValue / quantity : 0);

        if (isClosedSheet) {
          const sellDate = parseDateValue(row[col.sellDate]);
          const sellPrice = col.sellPrice !== -1 ? parseNumeric(row[col.sellPrice]) : null;
          const rawSellValue = col.sellValue !== -1 ? parseNumeric(row[col.sellValue]) : null;
          const rawPnl = col.realisedPnl !== -1 ? parseNumeric(row[col.realisedPnl]) : null;

          if (sellDate === null || (sellPrice === null && rawSellValue === null)) {
            warnings.push(
              `INDmoney closed trade row ${r + 1} (${script}) has missing/invalid sell date or price.`
            );
            continue;
          }

          const sellValue = rawSellValue ?? quantity * (sellPrice ?? 0);
          const effSellPrice = sellPrice ?? (quantity > 0 ? sellValue / quantity : 0);
          const realisedPnL = rawPnl ?? sellValue - buyValue;

          closedTrades.push({
            id: `${sourceId}-closed-${sheetName}-${r + 1}`,
            sourceId,
            brokerLabel: 'INDmoney',
            rowNumber: r + 1,
            script,
            isin,
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
        } else {
          const closingDate =
            col.closingDate !== -1 ? parseDateValue(row[col.closingDate]) : null;
          const closingPrice =
            col.currentPrice !== -1 ? parseNumeric(row[col.currentPrice]) : null;
          const rawClosingValue =
            col.currentValue !== -1 ? parseNumeric(row[col.currentValue]) : null;
          const rawPnl = col.unrealisedPnl !== -1 ? parseNumeric(row[col.unrealisedPnl]) : null;

          if (rawClosingValue === null && closingPrice === null) {
            warnings.push(
              `INDmoney active holding row ${r + 1} (${script}) is missing closing value/price.`
            );
            continue;
          }

          const closingValue = rawClosingValue ?? quantity * (closingPrice ?? 0);
          const effClosingPrice =
            closingPrice ?? (quantity > 0 ? closingValue / quantity : 0);
          const unrealisedPnL = rawPnl ?? closingValue - buyValue;

          rawActiveWithoutValuation.push({
            id: `${sourceId}-active-${sheetName}-${r + 1}`,
            sourceId,
            brokerLabel: 'INDmoney',
            rowNumber: r + 1,
            script,
            isin,
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
        }
      }
    }

    if (rawActiveWithoutValuation.length === 0 && closedTrades.length === 0) {
      throw new ParserTemplateMismatchError(
        'No lot-level records matched the baseline INDmoney template. Use the Column Mapper below to map fields manually.',
        'indmoney'
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
        'Could not determine the report valuation date from the INDmoney workbook.',
        'indmoney'
      );
    }

    const activeLots: ActiveLotRaw[] = rawActiveWithoutValuation.map((lot) => ({
      ...lot,
      sourceValuationDate: valuationDate,
    }));

    return {
      sourceId,
      brokerType: 'indmoney',
      brokerLabel: 'INDmoney',
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
