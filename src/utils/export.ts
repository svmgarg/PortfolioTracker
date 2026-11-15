import * as XLSX from 'xlsx';
import type { ActiveLotComputed, ClosedTradeComputed } from '../types/portfolio';
import { formatCalendarDate, formatPercent } from './calculations';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(headers: string[], rows: Array<Array<string | number>>, filename: string) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  // UTF-8 BOM ensures Excel opens currency symbols cleanly
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename);
}

function buildActiveExportRows(lots: ActiveLotComputed[]) {
  const headers = [
    'Script',
    'Buy Date',
    'Quantity',
    'Buy Price (₹)',
    'Holding Days',
    'Classification',
    'Current Value (₹)',
    'P&L (₹)',
    'P&L (%)',
    'Remark',
  ];

  const rows = lots.map((lot) => [
    lot.script,
    formatCalendarDate(lot.buyDate),
    Number(lot.quantity.toFixed(4)),
    Number(lot.buyPrice.toFixed(2)),
    lot.holdingDays,
    lot.classification,
    Number(lot.closingValue.toFixed(2)),
    Number(lot.unrealisedPnL.toFixed(2)),
    formatPercent(lot.pnlPercent),
    lot.remark || '',
  ]);

  return { headers, rows };
}

function buildClosedExportRows(trades: ClosedTradeComputed[]) {
  const headers = [
    'Script',
    'Buy Date',
    'Sell Date',
    'Quantity',
    'Buy Price (₹)',
    'Sell Price (₹)',
    'Holding Days',
    'Classification',
    'Realised P&L (₹)',
    'P&L (%)',
    'Remark',
  ];

  const rows = trades.map((trade) => [
    trade.script,
    formatCalendarDate(trade.buyDate),
    formatCalendarDate(trade.sellDate),
    Number(trade.quantity.toFixed(4)),
    Number(trade.buyPrice.toFixed(2)),
    Number(trade.sellPrice.toFixed(2)),
    trade.holdingDays,
    trade.classification,
    Number(trade.realisedPnL.toFixed(2)),
    formatPercent(trade.pnlPercent),
    trade.remark || (trade.isIntraday ? 'Intraday' : ''),
  ]);

  return { headers, rows };
}

export function exportActiveHoldings(
  lots: ActiveLotComputed[],
  format: 'xlsx' | 'csv'
): void {
  const { headers, rows } = buildActiveExportRows(lots);
  const stamp = lots[0]?.valuationDate
    ? formatCalendarDate(lots[0].valuationDate)
    : 'export';

  if (format === 'csv') {
    downloadCsv(headers, rows, `Active_Holdings_${stamp}.csv`);
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 13 },
    { wch: 10 },
    { wch: 15 },
    { wch: 13 },
    { wch: 14 },
    { wch: 17 },
    { wch: 15 },
    { wch: 11 },
    { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Active Holdings');
  XLSX.writeFile(workbook, `Active_Holdings_${stamp}.xlsx`);
}

export function exportClosedTrades(
  trades: ClosedTradeComputed[],
  format: 'xlsx' | 'csv',
  valuationDateLabel: string
): void {
  const { headers, rows } = buildClosedExportRows(trades);

  if (format === 'csv') {
    downloadCsv(headers, rows, `Closed_Trades_${valuationDateLabel}.csv`);
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 13 },
    { wch: 13 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 13 },
    { wch: 14 },
    { wch: 17 },
    { wch: 11 },
    { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Closed Trades');
  XLSX.writeFile(workbook, `Closed_Trades_${valuationDateLabel}.xlsx`);
}
