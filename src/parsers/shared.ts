import type * as XLSX from 'xlsx';
import type { BrokerSourceType, CalendarDate, LoadedSource } from '../types/portfolio';
import { compareCalendarDates, parseDateValue } from '../utils/calculations';

export type RawRow = unknown[];

export interface BrokerParser {
  brokerType: Exclude<BrokerSourceType, 'custom'>;
  displayName: string;
  canParse: (workbook: XLSX.WorkBook) => boolean;
  parse: (workbook: XLSX.WorkBook, sourceId: string) => LoadedSource;
}

export class ParserTemplateMismatchError extends Error {
  brokerType: BrokerSourceType;
  canFallbackToMapper: boolean;

  constructor(
    message: string,
    brokerType: BrokerSourceType,
    canFallbackToMapper = true
  ) {
    super(message);
    this.name = 'ParserTemplateMismatchError';
    this.brokerType = brokerType;
    this.canFallbackToMapper = canFallbackToMapper;
  }
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\(₹\)|₹|\(rs\.?\)/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

export function isRowEmpty(row: RawRow | undefined): boolean {
  if (!row || row.length === 0) return true;
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    let cleaned = value.trim();
    if (!cleaned || cleaned === '-' || cleaned === '—' || cleaned.toLowerCase() === 'na') {
      return null;
    }
    let isNegative = false;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      isNegative = true;
      cleaned = cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/[₹,\s]/g, '');
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return null;
    return isNegative ? -parsed : parsed;
  }
  return null;
}

export function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function isTotalRow(row: RawRow): boolean {
  const nonEmpty = row.map(normalizeText).filter(Boolean);
  if (nonEmpty.length === 0) return false;
  const first = nonEmpty[0].toLowerCase();
  return first === 'total' || first === 'grand total' || first.startsWith('total ');
}

export function extractMetadataEndDate(rows: RawRow[], limitRow = 25): CalendarDate | null {
  const limit = Math.min(rows.length, limitRow > 0 ? limitRow : 25);
  let latestFound: CalendarDate | null = null;

  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (isRowEmpty(row)) continue;
    for (const cell of row) {
      const text = normalizeText(cell);
      if (!text) continue;
      const matches = text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g);
      if (matches) {
        for (const m of matches) {
          const parsed = parseDateValue(m);
          if (parsed && (!latestFound || compareCalendarDates(parsed, latestFound) > 0)) {
            latestFound = parsed;
          }
        }
      }
    }
  }
  return latestFound;
}
