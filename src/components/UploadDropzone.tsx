import React, { useState } from 'react';
import { AlertCircle, FileSpreadsheet, Plus, ShieldCheck, Upload } from 'lucide-react';

interface UploadDropzoneProps {
  onOpenDrawer: () => void;
  onDropFiles: (files: FileList | File[]) => void;
  errorMessage: string | null;
  duplicateNotice: string | null;
  isProcessing: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onOpenDrawer,
  onDropFiles,
  errorMessage,
  duplicateNotice,
  isProcessing,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-8 sm:p-10 text-center transition-colors ${
            isDragging ? 'bg-blue-50/70' : 'bg-white'
          }`}
        >
          <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" aria-hidden="true" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Upload Your Portfolio P&amp;L Reports
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto">
            Import Stock &amp; ETF P&amp;L reports from Groww, Zerodha, INDmoney, or custom{' '}
            <span className="font-mono text-slate-700">.xlsx</span> /{' '}
            <span className="font-mono text-slate-700">.csv</span> files across multiple family
            accounts and financial years.
          </p>

          <div
            className={`mt-7 rounded-xl border-2 border-dashed p-6 sm:p-8 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50/80'
                : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
            }`}
          >
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Drag &amp; drop files here, or open the source table to select brokers, custom
              labels, and multi-year reports.
            </p>
            <button
              type="button"
              onClick={onOpenDrawer}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Source</span>
            </button>
          </div>

          {duplicateNotice && (
            <div
              role="status"
              className="mt-5 rounded-lg bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5 text-left text-xs sm:text-sm text-amber-900"
            >
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{duplicateNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-lg bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-left"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-red-900">
                  Unable to load report
                </p>
                <p className="mt-0.5 text-xs sm:text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>100% local browser processing. Your portfolio data never leaves your device.</span>
        </div>
      </div>
    </div>
  );
};
