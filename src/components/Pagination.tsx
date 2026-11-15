import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}) => {
  const getPageNumbers = (): Array<number | 'ellipsis'> => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: Array<number | 'ellipsis'> = [1];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) pages.push('ellipsis');
    for (let p = left; p <= right; p++) {
      pages.push(p);
    }
    if (right < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
      <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
        <div className="flex items-center gap-2">
          <label htmlFor="rows-per-page-select" className="text-xs font-medium text-slate-600">
            Rows per page:
          </label>
          <select
            id="rows-per-page-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 px-2 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs sm:text-sm tabular-nums text-slate-600">
          {totalItems === 0
            ? `Showing 0 ${itemLabel}`
            : `Showing ${startIndex}–${endIndex} of ${totalItems} ${itemLabel}`}
        </span>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {getPageNumbers().map((entry, idx) =>
              entry === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onPageChange(entry)}
                  aria-current={entry === currentPage ? 'page' : undefined}
                  className={`h-8 min-w-[32px] px-2 text-xs font-semibold rounded-md tabular-nums transition-colors cursor-pointer ${
                    entry === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                  }`}
                >
                  {entry}
                </button>
              )
            )}
          </div>

          <span className="sm:hidden px-2 text-xs font-medium tabular-nums">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
};
