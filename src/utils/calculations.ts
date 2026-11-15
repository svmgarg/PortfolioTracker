import * as XLSX from 'xlsx';
import type {
  ActiveLotComputed,
  ActiveLotRaw,
  CalendarDate,
  Classification,
  ClosedTradeComputed,
  ClosedTradeRaw,
  InstrumentCategory,
  TaxSettings,
} from '../types/portfolio';

const MS_PER_DAY = 86_400_000;

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Parses Excel serial dates, JS Date objects, and common string formats
 * (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY) into a timezone-free CalendarDate.
 */
export function parseDateValue(raw: unknown): CalendarDate | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && isValidCalendarDate(parsed.y, parsed.m, parsed.d)) {
      return { year: parsed.y, month: parsed.m, day: parsed.d };
    }
    return null;
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return {
      year: raw.getFullYear(),
      month: raw.getMonth() + 1,
      day: raw.getDate(),
    };
  }

  if (typeof raw === 'string') {
    const cleaned = raw.trim();
    if (!cleaned) return null;

    // Strip optional time portion (e.g. "23-10-2025 10:15:00" or ISO "2025-10-23T00:00:00Z")
    const datePart = cleaned.split(/[T\s]+/)[0];

    // DD-MM-YYYY or DD/MM/YYYY (authoritative Groww format)
    let match = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      if (isValidCalendarDate(year, month, day)) {
        return { year, month, day };
      }
    }

    // YYYY-MM-DD or YYYY/MM/DD
    match = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (isValidCalendarDate(year, month, day)) {
        return { year, month, day };
      }
    }

    // DD-MMM-YYYY or DD MMM YYYY (e.g. 14-Nov-2026)
    match = cleaned.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = MONTH_NAME_MAP[match[2].toLowerCase()];
      const year = Number(match[3]);
      if (month && isValidCalendarDate(year, month, day)) {
        return { year, month, day };
      }
    }
  }

  return null;
}

export function calendarDateToUTC(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function diffCalendarDays(start: CalendarDate, end: CalendarDate): number {
  return Math.round((calendarDateToUTC(end) - calendarDateToUTC(start)) / MS_PER_DAY);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Adds exact calendar months to a date, clamping day to the target month's length
 * (e.g. 31-Jan + 1 month -> 28-Feb or 29-Feb).
 */
export function addCalendarMonths(date: CalendarDate, monthsToAdd: number): CalendarDate {
  const zeroBasedMonth = date.month - 1 + monthsToAdd;
  const targetYear = date.year + Math.floor(zeroBasedMonth / 12);
  const targetMonthZero = ((zeroBasedMonth % 12) + 12) % 12;
  const targetMonth = targetMonthZero + 1;
  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(date.day, maxDay);

  return {
    year: targetYear,
    month: targetMonth,
    day: targetDay,
  };
}

/**
 * Holding period classification:
 * - More than N calendar months => LT
 * - N calendar months or less => ST
 */
export function classifyHoldingPeriod(
  buyDate: CalendarDate,
  endDate: CalendarDate,
  thresholdMonths: number
): Classification {
  const thresholdDate = addCalendarMonths(buyDate, thresholdMonths);
  return compareCalendarDates(endDate, thresholdDate) > 0 ? 'LT' : 'ST';
}

export function calculatePnlPercent(pnl: number, buyValue: number): number {
  if (!Number.isFinite(buyValue) || Math.abs(buyValue) < 1e-9) {
    return 0;
  }
  const pct = (pnl / buyValue) * 100;
  return Number.isFinite(pct) ? pct : 0;
}

export function resolveInstrumentCategory(
  script: string,
  settings: TaxSettings
): InstrumentCategory {
  return settings.scriptCategoryOverrides[script] ?? 'equity_etf';
}

export function getThresholdForScript(
  script: string,
  settings: TaxSettings
): { category: InstrumentCategory; months: number } {
  const category = resolveInstrumentCategory(script, settings);
  const months =
    category === 'equity_etf'
      ? settings.holdingPeriodMonths
      : settings.categoryThresholds[category] ?? settings.holdingPeriodMonths;
  return { category, months };
}

export function computeActiveLot(
  lot: ActiveLotRaw,
  reportValuationDate: CalendarDate,
  settings: TaxSettings
): ActiveLotComputed {
  const effectiveValuationDate = lot.closingDate ?? reportValuationDate;
  const holdingDays = diffCalendarDays(lot.buyDate, effectiveValuationDate);
  const { category, months } = getThresholdForScript(lot.script, settings);
  const classification = classifyHoldingPeriod(lot.buyDate, effectiveValuationDate, months);
  const pnlPercent = calculatePnlPercent(lot.unrealisedPnL, lot.buyValue);

  return {
    ...lot,
    holdingDays,
    classification,
    pnlPercent,
    valuationDate: effectiveValuationDate,
    category,
  };
}

export function computeClosedTrade(
  trade: ClosedTradeRaw,
  settings: TaxSettings
): ClosedTradeComputed {
  const holdingDays = diffCalendarDays(trade.buyDate, trade.sellDate);
  const { category, months } = getThresholdForScript(trade.script, settings);
  const classification = classifyHoldingPeriod(trade.buyDate, trade.sellDate, months);
  const pnlPercent = calculatePnlPercent(trade.realisedPnL, trade.buyValue);

  return {
    ...trade,
    holdingDays,
    classification,
    pnlPercent,
    category,
  };
}

export function formatCalendarDate(date: CalendarDate): string {
  const dd = String(date.day).padStart(2, '0');
  const mm = String(date.month).padStart(2, '0');
  return `${dd}-${mm}-${date.year}`;
}

export function formatCalendarDateReadable(date: CalendarDate): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(date.day).padStart(2, '0');
  return `${dd}-${months[date.month - 1]}-${date.year}`;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export function formatINR(value: number, options?: { showPlus?: boolean }): string {
  const safe = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = inrFormatter.format(Math.abs(safe));
  if (safe < 0) return `-₹${formatted}`;
  if (options?.showPlus && safe > 0) return `+₹${formatted}`;
  return `₹${formatted}`;
}

export function formatNumber(value: number): string {
  const safe = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = inrFormatter.format(Math.abs(safe));
  return safe < 0 ? `-${formatted}` : formatted;
}

export function formatQuantity(value: number): string {
  return qtyFormatter.format(value);
}

export function formatPercent(value: number): string {
  const safe = Math.abs(value) < 0.005 ? 0 : value;
  const absFormatted = Math.abs(safe).toFixed(2);
  if (safe > 0) return `+${absFormatted}%`;
  if (safe < 0) return `-${absFormatted}%`;
  return `0.00%`;
}
