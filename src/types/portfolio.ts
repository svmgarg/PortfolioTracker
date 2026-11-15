export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export type Classification = 'LT' | 'ST';

export type InstrumentCategory = 'equity_etf' | 'debt_other';

export type BrokerSourceType = 'groww' | 'zerodha' | 'indmoney' | 'custom';

export interface ActiveLotRaw {
  id: string;
  sourceId: string;
  brokerLabel: string;
  sourceValuationDate: CalendarDate;
  rowNumber: number;
  script: string;
  isin: string;
  quantity: number;
  buyDate: CalendarDate;
  buyPrice: number;
  buyValue: number;
  closingDate: CalendarDate | null;
  closingPrice: number;
  closingValue: number;
  unrealisedPnL: number;
  remark: string;
}

export interface ClosedTradeRaw {
  id: string;
  sourceId: string;
  brokerLabel: string;
  rowNumber: number;
  script: string;
  isin: string;
  quantity: number;
  buyDate: CalendarDate;
  buyPrice: number;
  buyValue: number;
  sellDate: CalendarDate;
  sellPrice: number;
  sellValue: number;
  realisedPnL: number;
  remark: string;
  isIntraday: boolean;
}

export interface ActiveLotComputed extends ActiveLotRaw {
  holdingDays: number;
  classification: Classification;
  pnlPercent: number;
  valuationDate: CalendarDate;
  category: InstrumentCategory;
}

export interface ClosedTradeComputed extends ClosedTradeRaw {
  holdingDays: number;
  classification: Classification;
  pnlPercent: number;
  category: InstrumentCategory;
}

export interface ReportSummary {
  realisedPnL: number | null;
  unrealisedPnL: number | null;
  charges: number | null;
}

export interface ScripValidationSummary {
  found: boolean;
  totalRealisedPnL: number | null;
  totalUnrealisedPnL: number | null;
  scripCount: number;
}

export interface LoadedSource {
  sourceId: string;
  brokerType: BrokerSourceType;
  brokerLabel: string;
  valuationDate: CalendarDate;
  reportSummary: ReportSummary;
  scripValidation: ScripValidationSummary;
  activeLots: ActiveLotRaw[];
  closedTrades: ClosedTradeRaw[];
  warnings: string[];
}

export interface TaxSettings {
  holdingPeriodMonths: number;
  categoryThresholds: Record<InstrumentCategory, number>;
  scriptCategoryOverrides: Record<string, InstrumentCategory>;
}

export type ClassificationFilter = 'ALL' | Classification;

export type ActiveSortField =
  | 'script'
  | 'source'
  | 'buyDate'
  | 'quantity'
  | 'buyPrice'
  | 'holdingDays'
  | 'classification'
  | 'currentValue'
  | 'pnl'
  | 'pnlPercent';

export type ClosedSortField =
  | 'script'
  | 'source'
  | 'buyDate'
  | 'sellDate'
  | 'quantity'
  | 'buyPrice'
  | 'sellPrice'
  | 'holdingDays'
  | 'classification'
  | 'pnl'
  | 'pnlPercent';

export type SortDirection = 'asc' | 'desc';

export interface TabFilterState<TSort extends string> {
  selectedSource: string; // 'ALL' or sourceId
  selectedScript: string; // 'ALL' or exact script name
  classification: ClassificationFilter;
  searchQuery: string;
  sortField: TSort;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}
