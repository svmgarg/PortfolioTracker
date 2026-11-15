import * as XLSX from 'xlsx';
import type { BrokerSourceType, LoadedSource } from '../types/portfolio';
import { growwParser } from './growwParser';
import { indmoneyParser } from './indmoneyParser';
import { type BrokerParser, ParserTemplateMismatchError } from './shared';
import { zerodhaParser } from './zerodhaParser';

export const BROKER_PARSERS: BrokerParser[] = [
  growwParser,
  zerodhaParser,
  indmoneyParser,
];

export type PreferredBrokerOption = 'auto' | BrokerSourceType;

export type RegistryParseOutcome =
  | {
      status: 'parsed';
      source: LoadedSource;
    }
  | {
      status: 'needs_mapping';
      fileName: string;
      workbook: XLSX.WorkBook;
      suggestedBrokerLabel: string;
      reason: string;
    };

function createSourceId(brokerType: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${brokerType}-${Date.now()}-${rand}`;
}

export async function parseFileWithRegistry(
  file: File,
  preferredBroker: PreferredBrokerOption = 'auto'
): Promise<RegistryParseOutcome> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv') && !lower.endsWith('.xls')) {
    throw new Error(
      `Unsupported file format (${file.name}). Please upload an .xlsx or .csv report.`
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error(`Workbook "${file.name}" does not contain any readable sheets.`);
  }

  if (preferredBroker === 'custom') {
    return {
      status: 'needs_mapping',
      fileName: file.name,
      workbook,
      suggestedBrokerLabel: 'Custom',
      reason: 'Custom column mapping selected.',
    };
  }

  const selectedParser =
    preferredBroker === 'auto'
      ? BROKER_PARSERS.find((p) => p.canParse(workbook))
      : BROKER_PARSERS.find((p) => p.brokerType === preferredBroker);

  if (!selectedParser) {
    return {
      status: 'needs_mapping',
      fileName: file.name,
      workbook,
      suggestedBrokerLabel: 'Custom',
      reason:
        'Could not auto-detect Groww, Zerodha, or INDmoney template headers. Map the columns below to import.',
    };
  }

  try {
    const sourceId = createSourceId(selectedParser.brokerType);
    const parsed = selectedParser.parse(workbook, sourceId);
    return { status: 'parsed', source: parsed };
  } catch (err) {
    if (err instanceof ParserTemplateMismatchError && err.canFallbackToMapper) {
      return {
        status: 'needs_mapping',
        fileName: file.name,
        workbook,
        suggestedBrokerLabel: selectedParser.displayName,
        reason: err.message,
      };
    }
    throw err;
  }
}
