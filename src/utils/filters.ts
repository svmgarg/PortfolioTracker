import type {
  ActiveLotComputed,
  ActiveSortField,
  ClosedSortField,
  ClosedTradeComputed,
  TabFilterState,
} from '../types/portfolio';
import { compareCalendarDates } from './calculations';

export function getUniqueScripts(records: Array<{ script: string }>): string[] {
  const unique = new Set<string>();
  for (const item of records) {
    if (item.script) unique.add(item.script);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export function filterActiveLots(
  lots: ActiveLotComputed[],
  filter: Pick<
    TabFilterState<ActiveSortField>,
    'selectedSource' | 'selectedScript' | 'classification' | 'searchQuery'
  >
): ActiveLotComputed[] {
  const query = filter.searchQuery.trim().toLowerCase();

  return lots.filter((lot) => {
    if (filter.selectedSource !== 'ALL' && lot.brokerLabel !== filter.selectedSource) {
      return false;
    }
    if (filter.selectedScript !== 'ALL' && lot.script !== filter.selectedScript) {
      return false;
    }
    if (filter.classification !== 'ALL' && lot.classification !== filter.classification) {
      return false;
    }
    if (query && !lot.script.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

export function sortActiveLots(
  lots: ActiveLotComputed[],
  sortField: ActiveSortField,
  sortDirection: 'asc' | 'desc'
): ActiveLotComputed[] {
  const factor = sortDirection === 'asc' ? 1 : -1;

  return [...lots].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'script':
        cmp = a.script.localeCompare(b.script);
        if (cmp === 0) cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'source':
        cmp = a.brokerLabel.localeCompare(b.brokerLabel);
        if (cmp === 0) cmp = a.script.localeCompare(b.script);
        if (cmp === 0) cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'buyDate':
        cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'quantity':
        cmp = a.quantity - b.quantity;
        break;
      case 'buyPrice':
        cmp = a.buyPrice - b.buyPrice;
        break;
      case 'holdingDays':
        cmp = a.holdingDays - b.holdingDays;
        break;
      case 'classification':
        cmp = a.classification.localeCompare(b.classification);
        if (cmp === 0) cmp = a.script.localeCompare(b.script);
        if (cmp === 0) cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'currentValue':
        cmp = a.closingValue - b.closingValue;
        break;
      case 'pnl':
        cmp = a.unrealisedPnL - b.unrealisedPnL;
        break;
      case 'pnlPercent':
        cmp = a.pnlPercent - b.pnlPercent;
        break;
    }
    if (cmp !== 0) return cmp * factor;
    return a.rowNumber - b.rowNumber;
  });
}

export function filterClosedTrades(
  trades: ClosedTradeComputed[],
  filter: Pick<
    TabFilterState<ClosedSortField>,
    'selectedSource' | 'selectedScript' | 'classification' | 'searchQuery'
  >
): ClosedTradeComputed[] {
  const query = filter.searchQuery.trim().toLowerCase();

  return trades.filter((trade) => {
    if (filter.selectedSource !== 'ALL' && trade.brokerLabel !== filter.selectedSource) {
      return false;
    }
    if (filter.selectedScript !== 'ALL' && trade.script !== filter.selectedScript) {
      return false;
    }
    if (filter.classification !== 'ALL' && trade.classification !== filter.classification) {
      return false;
    }
    if (query && !trade.script.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

export function sortClosedTrades(
  trades: ClosedTradeComputed[],
  sortField: ClosedSortField,
  sortDirection: 'asc' | 'desc'
): ClosedTradeComputed[] {
  const factor = sortDirection === 'asc' ? 1 : -1;

  return [...trades].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'script':
        cmp = a.script.localeCompare(b.script);
        if (cmp === 0) cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'source':
        cmp = a.brokerLabel.localeCompare(b.brokerLabel);
        if (cmp === 0) cmp = a.script.localeCompare(b.script);
        if (cmp === 0) cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'buyDate':
        cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'sellDate':
        cmp = compareCalendarDates(a.sellDate, b.sellDate);
        break;
      case 'quantity':
        cmp = a.quantity - b.quantity;
        break;
      case 'buyPrice':
        cmp = a.buyPrice - b.buyPrice;
        break;
      case 'sellPrice':
        cmp = a.sellPrice - b.sellPrice;
        break;
      case 'holdingDays':
        cmp = a.holdingDays - b.holdingDays;
        break;
      case 'classification':
        cmp = a.classification.localeCompare(b.classification);
        if (cmp === 0) cmp = a.script.localeCompare(b.script);
        if (cmp === 0) cmp = compareCalendarDates(a.buyDate, b.buyDate);
        break;
      case 'pnl':
        cmp = a.realisedPnL - b.realisedPnL;
        break;
      case 'pnlPercent':
        cmp = a.pnlPercent - b.pnlPercent;
        break;
    }
    if (cmp !== 0) return cmp * factor;
    return a.rowNumber - b.rowNumber;
  });
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  pagedItems: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  startIndex: number;
  endIndex: number;
} {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);

  return {
    pagedItems: items.slice(start, end),
    totalItems,
    totalPages,
    currentPage,
    startIndex: totalItems === 0 ? 0 : start + 1,
    endIndex: end,
  };
}
