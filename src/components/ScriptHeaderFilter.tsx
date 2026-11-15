import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Filter, Search, X } from 'lucide-react';
import type { SortDirection } from '../types/portfolio';

interface ScriptHeaderFilterProps {
  scripts: string[];
  selectedScript: string;
  isSortedByScript: boolean;
  sortDirection: SortDirection;
  onSort: () => void;
  onSelectScript: (script: string) => void;
}

export const ScriptHeaderFilter: React.FC<ScriptHeaderFilterProps> = ({
  scripts,
  selectedScript,
  isSortedByScript,
  sortDirection,
  onSort,
  onSelectScript,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isFiltered = selectedScript !== 'ALL';

  const visibleScripts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((s) => s.toLowerCase().includes(q));
  }, [scripts, query]);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const maxLeft = Math.max(12, window.innerWidth - popoverWidth - 12);
    setCoords({
      top: rect.bottom + 6,
      left: Math.min(rect.left, maxLeft),
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleViewportChange = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      if (!prev) {
        setQuery('');
      }
      return !prev;
    });
  };

  const handleChoose = (script: string) => {
    onSelectScript(script);
    setIsOpen(false);
  };

  return (
    <th
      scope="col"
      className="px-4 py-3 text-xs font-semibold text-blue-950 whitespace-nowrap select-none text-left"
    >
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1.5 hover:text-blue-700 transition-colors cursor-pointer"
        >
          <span>Script</span>
          {isSortedByScript ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          )}
        </button>

        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          aria-label="Filter by Script"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title={isFiltered ? `Filtered: ${selectedScript}` : 'Filter by Script'}
          className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer ${
            isFiltered
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : isOpen
              ? 'bg-blue-200/80 text-blue-900'
              : 'text-blue-500 hover:text-blue-800 hover:bg-blue-100'
          }`}
        >
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className="fixed z-50 w-[280px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden text-left font-normal"
        >
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
            <span className="text-xs font-semibold text-slate-700">Filter by Script</span>
            {isFiltered && (
              <button
                type="button"
                onClick={() => handleChoose('ALL')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find script..."
                className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear script filter search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <ul
            role="listbox"
            aria-label="Select script"
            className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={selectedScript === 'ALL'}
                onClick={() => handleChoose('ALL')}
                className={`w-full px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  selectedScript === 'ALL'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>All Scripts ({scripts.length})</span>
                {selectedScript === 'ALL' && (
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                )}
              </button>
            </li>

            {visibleScripts.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-500">
                No matching scripts
              </li>
            ) : (
              visibleScripts.map((script) => {
                const selected = selectedScript === script;
                return (
                  <li key={script}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleChoose(script)}
                      className={`w-full px-3 py-2 text-xs flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{script}</span>
                      {selected && (
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </th>
  );
};
