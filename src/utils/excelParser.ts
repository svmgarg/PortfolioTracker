import * as XLSX from 'xlsx';
import { growwParser } from '../parsers/growwParser';
import type { LoadedSource } from '../types/portfolio';

export function parseGrowwWorkbook(buffer: ArrayBuffer): LoadedSource {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  return growwParser.parse(workbook, 'groww-1');
}
