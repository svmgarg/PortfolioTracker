import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ActiveHoldingsTable } from './components/ActiveHoldingsTable';
import { ClosedTradesTable } from './components/ClosedTradesTable';
import { FilterToolbar } from './components/FilterToolbar';
import {
  GenericMapperModal,
  type PendingMappingRequest,
} from './components/GenericMapperModal';
import { Header } from './components/Header';
import { Pagination } from './components/Pagination';
import { SettingsModal } from './components/SettingsModal';
import { SourcesBar } from './components/SourcesBar';
import { SummaryCards } from './components/SummaryCards';
import { UploadDropzone } from './components/UploadDropzone';
import { ValidationBanner } from './components/ValidationBanner';
import {
  parseFileWithRegistry,
  type PreferredBrokerOption,
} from './parsers/parserRegistry';
import type {
  ActiveSortField,
  ClosedSortField,
  LoadedSource,
  TabFilterState,
  TaxSettings,
} from './types/portfolio';
import { computeActiveLot, computeClosedTrade } from './utils/calculations';
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
  selectedSource: 'ALL',
  selectedScript: 'ALL',
  classification: 'ALL',
  searchQuery: '',
  sortField: 'script',
  sortDirection: 'asc',
  page: 1,
  pageSize: 10,
};

const INITIAL_CLOSED_FILTER: TabFilterState<ClosedSortField> = {
  selectedSource: 'ALL',
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
  const [sources, setSources] = useState<LoadedSource[]>([]);
  const [preferredBroker, setPreferredBroker] = useState<PreferredBrokerOption>('auto');
  const [mappingQueue, setMappingQueue] = useState<PendingMappingRequest[]>([]);
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

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessing(true);
    setUploadError(null);

    const parsedSources: LoadedSource[] = [];
    const pendingMappings: PendingMappingRequest[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const outcome = await parseFileWithRegistry(file, preferredBroker);
        if (outcome.status === 'parsed') {
          parsedSources.push(outcome.source);
        } else {
          pendingMappings.push({
            fileName: outcome.fileName,
            workbook: outcome.workbook,
            suggestedBrokerLabel: outcome.suggestedBrokerLabel,
            reason: outcome.reason,
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : `Failed to process "${file.name}".`;
        errors.push(msg);
      }
    }

    if (parsedSources.length > 0) {
      setSources((prev) => [...prev, ...parsedSources]);
      setActiveFilter((prev) => ({ ...prev, page: 1 }));
      setClosedFilter((prev) => ({ ...prev, page: 1 }));
    }

    if (pendingMappings.length > 0) {
      setMappingQueue((prev) => [...prev, ...pendingMappings]);
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' '));
    }

    setIsProcessing(false);
  };

  const handleMappedImport = (mappedSource: LoadedSource) => {
    setSources((prev) => [...prev, mappedSource]);
    setMappingQueue((prev) => prev.slice(1));
  };

  const handleSkipMapping = () => {
    setMappingQueue((prev) => prev.slice(1));
  };

  const handleRemoveSource = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.sourceId !== sourceId));
    setActiveFilter((prev) => ({
      ...prev,
      selectedSource: prev.selectedSource === sourceId ? 'ALL' : prev.selectedSource,
      page: 1,
    }));
    setClosedFilter((prev) => ({
      ...prev,
      selectedSource: prev.selectedSource === sourceId ? 'ALL' : prev.selectedSource,
      page: 1,
    }));
  };

  const handleClearAllSources = () => {
    setSources([]);
    setActiveFilter(INITIAL_ACTIVE_FILTER);
    setClosedFilter(INITIAL_CLOSED_FILTER);
    setUploadError(null);
  };

  const handleSaveSettings = (updated: TaxSettings) => {
    setSettings(updated);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors
    }
  };

  const combinedWarnings = useMemo(
    () => sources.flatMap((s) => s.warnings),
    [sources]
  );

  const valuationDates = useMemo(
    () => sources.map((s) => s.valuationDate),
    [sources]
  );

  const computedActiveLots = useMemo(() => {
    return sources.flatMap((src) =>
      src.activeLots.map((lot) => computeActiveLot(lot, src.valuationDate, settings))
    );
  }, [sources, settings]);

  const computedClosedTrades = useMemo(() => {
    return sources.flatMap((src) =>
      src.closedTrades.map((trade) => computeClosedTrade(trade, settings))
    );
  }, [sources, settings]);

  const activeScripts = useMemo(() => getUniqueScripts(computedActiveLots), [computedActiveLots]);
  const closedScripts = useMemo(
    () => getUniqueScripts(computedClosedTrades),
    [computedClosedTrades]
  );

  const filteredActiveLots = useMemo(() => {
    const filtered = filterActiveLots(computedActiveLots, activeFilter);
    return sortActiveLots(filtered, activeFilter.sortField, activeFilter.sortDirection);
  }, [computedActiveLots, activeFilter]);

  const filteredClosedTrades = useMemo(() => {
    const filtered = filterClosedTrades(computedClosedTrades, closedFilter);
    return sortClosedTrades(filtered, closedFilter.sortField, closedFilter.sortDirection);
  }, [computedClosedTrades, closedFilter]);

  const pagedActive = useMemo(
    () => paginateItems(filteredActiveLots, activeFilter.page, activeFilter.pageSize),
    [filteredActiveLots, activeFilter.page, activeFilter.pageSize]
  );

  const pagedClosed = useMemo(
    () => paginateItems(filteredClosedTrades, closedFilter.page, closedFilter.pageSize),
    [filteredClosedTrades, closedFilter.page, closedFilter.pageSize]
  );

  const isActiveFiltered =
    activeFilter.selectedSource !== 'ALL' ||
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
        hasSources={sources.length > 0}
        holdingPeriodMonths={settings.holdingPeriodMonths}
        onFilesSelected={handleFilesSelected}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {sources.length === 0 ? (
          <UploadDropzone
            preferredBroker={preferredBroker}
            onPreferredBrokerChange={setPreferredBroker}
            onFilesSelected={handleFilesSelected}
            errorMessage={uploadError}
            isProcessing={isProcessing}
          />
        ) : (
          <div className="space-y-5">
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

            <SourcesBar
              sources={sources}
              onRemoveSource={handleRemoveSource}
              onClearAll={handleClearAllSources}
              onAddFiles={handleFilesSelected}
            />

            <ValidationBanner warnings={combinedWarnings} />

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
                    sources={sources}
                    selectedSource={activeFilter.selectedSource}
                    scripts={activeScripts}
                    selectedScript={activeFilter.selectedScript}
                    classification={activeFilter.classification}
                    searchQuery={activeFilter.searchQuery}
                    onSourceChange={(selectedSource) =>
                      setActiveFilter((prev) => ({ ...prev, selectedSource, page: 1 }))
                    }
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
                  />

                  <ActiveHoldingsTable
                    rows={pagedActive.pagedItems}
                    totalLotsCount={computedActiveLots.length}
                    filteredCount={filteredActiveLots.length}
                    valuationDates={valuationDates}
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
                    sources={sources}
                    selectedSource={closedFilter.selectedSource}
                    scripts={closedScripts}
                    selectedScript={closedFilter.selectedScript}
                    classification={closedFilter.classification}
                    searchQuery={closedFilter.searchQuery}
                    onSourceChange={(selectedSource) =>
                      setClosedFilter((prev) => ({ ...prev, selectedSource, page: 1 }))
                    }
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
            Long Term / Short Term labels indicate calendar-month holding periods (&gt;
            {settings.holdingPeriodMonths} months) and are not tax advice.
          </span>
        </div>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      <GenericMapperModal
        request={mappingQueue[0] ?? null}
        onImport={handleMappedImport}
        onSkip={handleSkipMapping}
      />
    </div>
  );
}
