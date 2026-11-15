import React, { useRef, useState } from 'react';
import { AlertCircle, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import type { PreferredBrokerOption } from '../parsers/parserRegistry';

interface UploadDropzoneProps {
  preferredBroker: PreferredBrokerOption;
  onPreferredBrokerChange: (broker: PreferredBrokerOption) => void;
  onFilesSelected: (files: FileList | File[]) => void;
  errorMessage: string | null;
  isProcessing: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  preferredBroker,
  onPreferredBrokerChange,
  onFilesSelected,
  errorMessage,
  isProcessing,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-700">Data Source Parser</p>
            <p className="text-xs text-slate-500">
              Auto-detects Groww or routes other broker reports cleanly
            </p>
          </div>
          <select
            aria-label="Select broker parser"
            value={preferredBroker}
            onChange={(e) => onPreferredBrokerChange(e.target.value as PreferredBrokerOption)}
            className="h-9 px-3 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="auto">Auto-detect (Recommended)</option>
            <option value="groww">Groww P&amp;L (.xlsx)</option>
            <option value="zerodha">Zerodha Console (.xlsx / .csv)</option>
            <option value="indmoney">INDmoney (.xlsx / .csv)</option>
            <option value="custom">Other Broker (Column Mapper)</option>
          </select>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 sm:p-12 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70'
              : 'border-slate-300 bg-slate-50/50 hover:border-blue-500 hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            onChange={handleInputChange}
            className="hidden"
            aria-label="Upload Groww or broker P&L reports"
          />

          <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            {isProcessing ? (
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-7 h-7" aria-hidden="true" />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Upload Your Groww P&amp;L Report
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Drag and drop one or multiple Excel/CSV files here or click to browse.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>{isProcessing ? 'Processing Workbook...' : 'Select .xlsx / .csv Files'}</span>
            </span>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Supported formats:{' '}
            <span className="font-mono font-medium text-slate-700">.xlsx</span>,{' '}
            <span className="font-mono font-medium text-slate-700">.csv</span> · Upload multiple
            brokers together
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-left"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-900">Unable to load report</p>
              <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>100% local browser processing. Your portfolio data never leaves your device.</span>
        </div>
      </div>
    </div>
  );
};
