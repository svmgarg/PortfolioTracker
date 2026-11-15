import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { computeBufferHash, type PreferredBrokerOption } from '../parsers/parserRegistry';

export interface StagedUploadItem {
  file: File;
  preferredBroker: PreferredBrokerOption;
  accountLabel: string;
  batchRowId: string;
}

interface StagedRowFile {
  file: File;
  contentHash: string;
  duplicateReason: 'staged' | 'loaded' | null;
}

interface UploadRowState {
  rowId: string;
  preferredBroker: PreferredBrokerOption;
  accountLabel: string;
  files: StagedRowFile[];
}

interface UploadDrawerProps {
  isOpen: boolean;
  hasExistingSources: boolean;
  initialFiles: File[];
  existingHashes: string[];
  existingLabels: string[];
  isProcessing: boolean;
  onSubmitBatch: (items: StagedUploadItem[]) => void | Promise<void>;
  onClose: () => void;
}

function createEmptyRow(index: number): UploadRowState {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    preferredBroker: 'auto',
    accountLabel: '',
    files: [],
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export const UploadDrawer: React.FC<UploadDrawerProps> = ({
  isOpen,
  hasExistingSources,
  initialFiles,
  existingHashes,
  existingLabels,
  isProcessing,
  onSubmitBatch,
  onClose,
}) => {
  const [rows, setRows] = useState<UploadRowState[]>(() => [createEmptyRow(1)]);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const datalistId = useId();

  const recomputeAllDuplicates = (
    nextRows: UploadRowState[],
    loadedHashes: string[]
  ): UploadRowState[] => {
    const loadedSet = new Set(loadedHashes);
    const seen = new Set<string>();
    return nextRows.map((row) => ({
      ...row,
      files: row.files.map((entry) => {
        if (loadedSet.has(entry.contentHash)) {
          return { ...entry, duplicateReason: 'loaded' as const };
        }
        if (seen.has(entry.contentHash)) {
          return { ...entry, duplicateReason: 'staged' as const };
        }
        seen.add(entry.contentHash);
        return { ...entry, duplicateReason: null };
      }),
    }));
  };

  useEffect(() => {
    if (!isOpen) return;

    const firstRow = createEmptyRow(1);
    if (initialFiles.length === 0) {
      setRows([firstRow]);
      return;
    }

    let cancelled = false;
    (async () => {
      const hashedEntries: StagedRowFile[] = await Promise.all(
        initialFiles.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const contentHash = await computeBufferHash(buffer);
          return { file, contentHash, duplicateReason: null };
        })
      );
      if (cancelled) return;
      const seenInRow = new Set<string>();
      const deduped = hashedEntries.filter((entry) => {
        if (seenInRow.has(entry.contentHash)) return false;
        seenInRow.add(entry.contentHash);
        return true;
      });
      setRows(
        recomputeAllDuplicates([{ ...firstRow, files: deduped }], existingHashes)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialFiles, existingHashes]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleBrokerChange = (rowId: string, preferredBroker: PreferredBrokerOption) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, preferredBroker } : row))
    );
  };

  const handleLabelChange = (rowId: string, accountLabel: string) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, accountLabel } : row))
    );
  };

  const appendFilesToRow = async (rowId: string, fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const hashedEntries: StagedRowFile[] = await Promise.all(
      incoming.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const contentHash = await computeBufferHash(buffer);
        return { file, contentHash, duplicateReason: null };
      })
    );

    setRows((prev) =>
      recomputeAllDuplicates(
        prev.map((row) => {
          if (row.rowId !== rowId) return row;
          const existingRowHashes = new Set(row.files.map((f) => f.contentHash));
          const uniqueNew = hashedEntries.filter((f) => {
            if (existingRowHashes.has(f.contentHash)) return false;
            existingRowHashes.add(f.contentHash);
            return true;
          });
          return { ...row, files: [...row.files, ...uniqueNew] };
        }),
        existingHashes
      )
    );
  };

  const handleFileInputChange = async (
    rowId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await appendFilesToRow(rowId, files);
    }
    e.target.value = '';
  };

  const handleRowDrop = async (rowId: string, e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingRowId(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await appendFilesToRow(rowId, e.dataTransfer.files);
    }
  };

  const handleClearRowFiles = (rowId: string) => {
    setRows((prev) =>
      recomputeAllDuplicates(
        prev.map((row) => (row.rowId === rowId ? { ...row, files: [] } : row)),
        existingHashes
      )
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow(1)];
      }
      return recomputeAllDuplicates(
        prev.filter((row) => row.rowId !== rowId),
        existingHashes
      );
    });
  };

  const readyItems: StagedUploadItem[] = rows.flatMap((row) =>
    row.files
      .filter((entry) => entry.duplicateReason === null)
      .map((entry) => ({
        file: entry.file,
        preferredBroker: row.preferredBroker,
        accountLabel: row.accountLabel,
        batchRowId: row.rowId,
      }))
  );

  const duplicateCount = rows.reduce(
    (sum, row) => sum + row.files.filter((f) => f.duplicateReason !== null).length,
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readyItems.length === 0 || isProcessing) return;
    await onSubmitBatch(readyItems);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={() => {
          if (!isProcessing) onClose();
        }}
        aria-hidden="true"
      />

      {/* Right Slide-Over Pane */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-4xl h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-in-right"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 id="upload-drawer-title" className="text-lg sm:text-xl font-bold text-slate-900">
              {hasExistingSources ? 'Add Sources & Yearly Reports' : 'Add Portfolio Sources'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Select a broker, enter an optional account label (e.g., Mine, Mother, Father), and
              attach one or multiple yearly files per row (
              <span className="font-mono text-slate-700">.xlsx</span> or{' '}
              <span className="font-mono text-slate-700">.csv</span>).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close upload drawer"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {existingLabels.length > 0 && (
          <datalist id={datalistId}>
            {existingLabels.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        )}

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[680px]">
                <thead className="bg-blue-50 border-b border-blue-200">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold text-blue-950 w-12 text-center"
                    >
                      #
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold text-blue-950 w-48">
                      Broker
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold text-blue-950 w-48">
                      Label (Custom)
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold text-blue-950">
                      Report Files (Multi-Year Supported)
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold text-blue-950 w-14 text-center"
                    >
                      <span className="sr-only">Remove row</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-sm">
                  {rows.map((row, idx) => {
                    const isDragging = draggingRowId === row.rowId;
                    const uniqueFiles = row.files.filter((f) => f.duplicateReason === null);
                    const hasLoadedDuplicate = row.files.some(
                      (f) => f.duplicateReason === 'loaded'
                    );
                    const totalBytes = uniqueFiles.reduce((sum, f) => sum + f.file.size, 0);

                    return (
                      <tr
                        key={row.rowId}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDraggingRowId(row.rowId);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setDraggingRowId(null);
                        }}
                        onDrop={(e) => handleRowDrop(row.rowId, e)}
                        className={`transition-colors ${
                          isDragging ? 'bg-blue-50/80' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-4 py-3.5 text-center text-xs font-mono font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <select
                            aria-label={`Broker for row ${idx + 1}`}
                            value={row.preferredBroker}
                            onChange={(e) =>
                              handleBrokerChange(
                                row.rowId,
                                e.target.value as PreferredBrokerOption
                              )
                            }
                            className="w-full h-9 px-2.5 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="auto">Auto-detect</option>
                            <option value="groww">Groww (.xlsx)</option>
                            <option value="zerodha">Zerodha (.xlsx / .csv)</option>
                            <option value="indmoney">INDmoney (.xlsx / .csv)</option>
                            <option value="custom">Custom Column Mapper</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <input
                            type="text"
                            list={existingLabels.length > 0 ? datalistId : undefined}
                            aria-label={`Custom account label for row ${idx + 1}`}
                            value={row.accountLabel}
                            onChange={(e) => handleLabelChange(row.rowId, e.target.value)}
                            placeholder="e.g. Mine, Mother, Father"
                            className="w-full h-9 px-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <input
                            ref={(el) => {
                              fileInputRefs.current[row.rowId] = el;
                            }}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            multiple
                            onChange={(e) => handleFileInputChange(row.rowId, e)}
                            className="hidden"
                            aria-label={`Choose files for row ${idx + 1}`}
                          />

                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRefs.current[row.rowId]?.click()}
                                className={`inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  row.files.length > 0
                                    ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
                                    : 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700'
                                }`}
                              >
                                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{row.files.length > 0 ? 'Add Files' : 'Select'}</span>
                              </button>

                              {row.files.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleClearRowFiles(row.rowId)}
                                  title="Clear files in this row"
                                  aria-label={`Clear files in row ${idx + 1}`}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>

                            {uniqueFiles.length > 0 ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 truncate">
                                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>
                                  {uniqueFiles.length}{' '}
                                  {uniqueFiles.length === 1 ? 'file' : 'files'} ready (
                                  {formatFileSize(totalBytes)})
                                </span>
                              </span>
                            ) : row.files.length > 0 ? (
                              <span className="text-xs font-medium text-amber-700 truncate">
                                {hasLoadedDuplicate
                                  ? 'Already loaded in portfolio'
                                  : 'Duplicate file (already selected)'}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 truncate">
                                Select 1 or more files, or drop here
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {(rows.length > 1 || row.files.length > 0) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              aria-label={`Remove row ${idx + 1}`}
                              title="Remove row"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs sm:text-sm font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Another Account</span>
            </button>
          </div>

          {duplicateCount > 0 && (
            <div
              role="status"
              className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 text-xs sm:text-sm text-amber-900"
            >
              <AlertCircle
                className="w-4 h-4 text-amber-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                {duplicateCount} duplicate {duplicateCount === 1 ? 'file was' : 'files were'}{' '}
                detected and will be skipped automatically.
              </span>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>100% local browser processing.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="h-10 px-4 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={readyItems.length === 0 || isProcessing}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Reports...</span>
                </>
              ) : (
                <>
                  <span>
                    {hasExistingSources ? 'Add to Portfolio' : 'Analyze Portfolio'}
                    {readyItems.length > 0
                      ? ` (${readyItems.length} ${readyItems.length === 1 ? 'File' : 'Files'})`
                      : ''}
                  </span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
