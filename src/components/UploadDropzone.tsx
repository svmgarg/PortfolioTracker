import React, { useRef, useState } from 'react';
import { AlertCircle, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  errorMessage: string | null;
  isProcessing: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelected,
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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-10">
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
            accept=".xlsx"
            onChange={handleInputChange}
            className="hidden"
            aria-label="Upload Groww P&L Excel Report"
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
            Drag and drop your Excel file here or click to browse.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>{isProcessing ? 'Processing Workbook...' : 'Select .xlsx File'}</span>
            </span>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Supported format: <span className="font-mono font-medium text-slate-700">.xlsx</span> (Groww Stocks P&amp;L Report)
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-5 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-left"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-900">Unable to load Excel workbook</p>
              <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>100% local browser processing. Your portfolio data never leaves your device.</span>
        </div>
      </div>
    </div>
  );
};
