import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ActiveHoldingsTable } from './components/ActiveHoldingsTable';
import { ClosedTradesTable } from './components/ClosedTradesTable';
import { FilterToolbar } from './components/FilterToolbar';
import { Header } from './components/Header';
import { Pagination } from './components/Pagination';
import { SettingsModal } from './components/SettingsModal';
import { SummaryCards } from './components/SummaryCards';
import { UploadDropzone } from './components/UploadDropzone';
import { ValidationBanner } from './components/ValidationBanner';
import type {
  ActiveSortField,
  ClosedSortField,
  ParsedWorkbookResult,
  TabFilterState,
  TaxSettings,
} from './types/portfolio';
import {
  computeActiveLot,
  computeClosedTrade,
  formatCalendarDate,
} from './utils/calculations';
import { parseGrowwWorkbook } from './utils/excelParser';
import { exportActiveHoldings, exportClosedTrades } from './utils/export';
import {
  filterActiveLots,
  filterClosedTrades,
  getUniqueScripts,
  paginateItems,
  sortActiveLots,
  sortClosedTrades,
} from './utils/filters';

type ActiveTab = 'active' | 'closed';

const DEFAULT_SETTINGS: TaxSettings = {
  holdingPeriodMonths: 12,
  categoryThresholds: {
    equity_etf: 12,
    debt_other: 24,
  },
  scriptCategoryOverrides: {},
};

const INITIAL_ACTIVE_FILTER: TabFilterState<ActiveSortField> = {
  selectedScript: 'ALL',
  classification: 'ALL',
  searchQuery: '',
  sortField: 'script',
  sortDirection: 'asc',
  page: 1,
  pageSize: 10,
};

const INITIAL_CLOSED_FILTER: TabFilterState<ClosedSortField> = {
  selectedScript: 'ALL',
  classification: 'ALL',
  searchQuery: '',
  sortField: 'script',
  sortDirection: 'asc',
  page: 1,
  pageSize: 10,
};

const SETTINGS_STORAGE_KEY = 'portfolio_tax_tracker_settings_v1';

function loadSavedSettings(): TaxSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TaxSettings>;
    if (
      typeof parsed.holdingPeriodMonths === 'number' &&
      parsed.holdingPeriodMonths >= 1 &&
      parsed.holdingPeriodMonths <= 120
    ) {
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        categoryThresholds: {
          ...DEFAULT_SETTINGS.categoryThresholds,
          ...(parsed.categoryThresholds ?? {}),
        },
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [workbook, setWorkbook] = useState<ParsedWorkbookResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [settings, setSettings] = useState<TaxSettings>(loadSavedSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<TabFilterState<ActiveSortField>>(
    INITIAL_ACTIVE_FILTER
  );
  const [closedFilter, setClosedFilter] = useState<TabFilterState<ClosedSortField>>(
    INITIAL_CLOSED_FILTER
  );

  const handleFileSelected = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx')) {
      setUploadError('Unsupported file format. Please upload a Groww P&L Excel (.xlsx) file.');
      return;
    }

    setIsProcessing(true);
    setUploadError(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseGrowwWorkbook(buffer);
      setWorkbook(parsed);
      setActiveFilter(INITIAL_ACTIVE_FILTER);
      setClosedFilter(INITIAL_CLOSED_FILTER);
      setActiveTab('active');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to read the Excel workbook. Verify it is a valid Groww Stocks P&L report.';
      setUploadError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = (updated: TaxSettings) => {
    setSettings(updated);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors
    }
  };

  // Compute lot-level holding days, classifications, and P&L %
  const computedActiveLots = useMemo(() => {
    if (!workbook) return [];
    return workbook.activeLots.map((lot) =>
      computeActiveLot(lot, workbook.valuationDate, settings)
    );
  }, [workbook, settings]);

  const computedClosedTrades = useMemo(() => {
    if (!workbook) return [];
    return workbook.closedTrades.map((trade) => computeClosedTrade(trade, settings));
  }, [workbook, settings]);

  // Unique scripts per tab (for dropdown only; never deduplicates table rows)
  const activeScripts = useMemo(() => getUniqueScripts(computedActiveLots), [computedActiveLots]);
  const closedScripts = useMemo(
    () => getUniqueScripts(computedClosedTrades),
    [computedClosedTrades]
  );

  // Filtered & sorted datasets
  const filteredActiveLots = useMemo(() => {
    const filtered = filterActiveLots(computedActiveLots, activeFilter);
    return sortActiveLots(filtered, activeFilter.sortField, activeFilter.sortDirection);
  }, [computedActiveLots, activeFilter]);

  const filteredClosedTrades = useMemo(() => {
    const filtered = filterClosedTrades(computedClosedTrades, closedFilter);
    return sortClosedTrades(filtered, closedFilter.sortField, closedFilter.sortDirection);
  }, [computedClosedTrades, closedFilter]);

  // Pagination slices
  const pagedActive = useMemo(
    () => paginateItems(filteredActiveLots, activeFilter.page, activeFilter.pageSize),
    [filteredActiveLots, activeFilter.page, activeFilter.pageSize]
  );

  const pagedClosed = useMemo(
    () => paginateItems(filteredClosedTrades, closedFilter.page, closedFilter.pageSize),
    [filteredClosedTrades, closedFilter.page, closedFilter.pageSize]
  );

  const isActiveFiltered =
    activeFilter.selectedScript !== 'ALL' ||
    activeFilter.classification !== 'ALL' ||
    activeFilter.searchQuery.trim() !== '';

  const handleActiveSort = (field: ActiveSortField) => {
    setActiveFilter((prev) => ({
      ...prev,
      page: 1,
      sortField: field,
      sortDirection:
        prev.sortField === field ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  };

  const handleClosedSort = (field: ClosedSortField) => {
    setClosedFilter((prev) => ({
      ...prev,
      page: 1,
      sortField: field,
      sortDirection:
        prev.sortField === field ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        hasWorkbook={workbook !== null}
        holdingPeriodMonths={settings.holdingPeriodMonths}
        onFileSelected={handleFileSelected}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!workbook ? (
          <UploadDropzone
            onFileSelected={handleFileSelected}
            errorMessage={uploadError}
            isProcessing={isProcessing}
          />
        ) : (
          <div className="space-y-6">
            {uploadError && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{uploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-xs font-semibold text-red-700 hover:text-red-900 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <ValidationBanner warnings={workbook.warnings} />

            {/* Four Summary Cards synced to Active Holdings filters */}
            <SummaryCards
              filteredActiveLots={filteredActiveLots}
              totalActiveCount={computedActiveLots.length}
              holdingPeriodMonths={settings.holdingPeriodMonths}
              isFiltered={isActiveFiltered}
            />

            {/* Primary Navigation Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200">
              <nav aria-label="Portfolio sections" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'active'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  Active Holdings ({computedActiveLots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('closed')}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'closed'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  Closed Trades ({computedClosedTrades.length})
                </button>
              </nav>
            </div>

            {/* Active Tab Card Container */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {activeTab === 'active' ? (
                <>
                  <FilterToolbar
                    scripts={activeScripts}
                    selectedScript={activeFilter.selectedScript}
                    classification={activeFilter.classification}
                    searchQuery={activeFilter.searchQuery}
                    filteredCount={filteredActiveLots.length}
                    onScriptChange={(selectedScript) =>
                      setActiveFilter((prev) => ({ ...prev, selectedScript, page: 1 }))
                    }
                    onClassificationChange={(classification) =>
                      setActiveFilter((prev) => ({ ...prev, classification, page: 1 }))
                    }
                    onSearchChange={(searchQuery) =>
                      setActiveFilter((prev) => ({ ...prev, searchQuery, page: 1 }))
                    }
                    onResetFilters={() => setActiveFilter(INITIAL_ACTIVE_FILTER)}
                    onExport={(format) => exportActiveHoldings(filteredActiveLots, format)}
                  />

                  <ActiveHoldingsTable
                    rows={pagedActive.pagedItems}
                    totalLotsCount={computedActiveLots.length}
                    filteredCount={filteredActiveLots.length}
                    valuationDate={workbook.valuationDate}
                    sortField={activeFilter.sortField}
                    sortDirection={activeFilter.sortDirection}
                    onSort={handleActiveSort}
                    onResetFilters={() => setActiveFilter(INITIAL_ACTIVE_FILTER)}
                  />

                  <Pagination
                    currentPage={pagedActive.currentPage}
                    totalPages={pagedActive.totalPages}
                    pageSize={activeFilter.pageSize}
                    totalItems={pagedActive.totalItems}
                    startIndex={pagedActive.startIndex}
                    endIndex={pagedActive.endIndex}
                    itemLabel="lots"
                    onPageChange={(page) => setActiveFilter((prev) => ({ ...prev, page }))}
                    onPageSizeChange={(pageSize) =>
                      setActiveFilter((prev) => ({ ...prev, pageSize, page: 1 }))
                    }
                  />
                </>
              ) : (
                <>
                  <FilterToolbar
                    scripts={closedScripts}
                    selectedScript={closedFilter.selectedScript}
                    classification={closedFilter.classification}
                    searchQuery={closedFilter.searchQuery}
                    filteredCount={filteredClosedTrades.length}
                    onScriptChange={(selectedScript) =>
                      setClosedFilter((prev) => ({ ...prev, selectedScript, page: 1 }))
                    }
                    onClassificationChange={(classification) =>
                      setClosedFilter((prev) => ({ ...prev, classification, page: 1 }))
                    }
                    onSearchChange={(searchQuery) =>
                      setClosedFilter((prev) => ({ ...prev, searchQuery, page: 1 }))
                    }
                    onResetFilters={() => setClosedFilter(INITIAL_CLOSED_FILTER)}
                    onExport={(format) =>
                      exportClosedTrades(
                        filteredClosedTrades,
                        format,
                        formatCalendarDate(workbook.valuationDate)
                      )
                    }
                  />

                  <ClosedTradesTable
                    rows={pagedClosed.pagedItems}
                    totalTradesCount={computedClosedTrades.length}
                    filteredCount={filteredClosedTrades.length}
                    sortField={closedFilter.sortField}
                    sortDirection={closedFilter.sortDirection}
                    onSort={handleClosedSort}
                    onResetFilters={() => setClosedFilter(INITIAL_CLOSED_FILTER)}
                  />

                  <Pagination
                    currentPage={pagedClosed.currentPage}
                    totalPages={pagedClosed.totalPages}
                    pageSize={closedFilter.pageSize}
                    totalItems={pagedClosed.totalItems}
                    startIndex={pagedClosed.startIndex}
                    endIndex={pagedClosed.endIndex}
                    itemLabel="trades"
                    onPageChange={(page) => setClosedFilter((prev) => ({ ...prev, page }))}
                    onPageSizeChange={(pageSize) =>
                      setClosedFilter((prev) => ({ ...prev, pageSize, page: 1 }))
                    }
                  />
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Portfolio Tax Tracker · Local browser-only processing</span>
          <span>
            LT/ST labels indicate calendar-month holding periods (&gt;{settings.holdingPeriodMonths}{' '}
            months) and are not tax advice.
          </span>
        </div>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
