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
      status: 'duplicate';
      fileName: string;
      contentHash: string;
    }
  | {
      status: 'needs_mapping';
      fileName: string;
      contentHash: string;
      workbook: XLSX.WorkBook;
      suggestedBrokerLabel: string;
      reason: string;
    };

function createSourceId(brokerType: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${brokerType}-${Date.now()}-${rand}`;
}

export async function computeBufferHash(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback deterministic dual-FNV-1a hash when crypto.subtle is unavailable
  const bytes = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= bytes[i] + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}-${bytes.length}`;
}

export async function parseFileWithRegistry(
  file: File,
  preferredBroker: PreferredBrokerOption = 'auto',
  existingHashes?: Set<string>
): Promise<RegistryParseOutcome> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv') && !lower.endsWith('.xls')) {
    throw new Error(
      `Unsupported file format (${file.name}). Please upload an .xlsx or .csv report.`
    );
  }

  const buffer = await file.arrayBuffer();
  const contentHash = await computeBufferHash(buffer);

  if (existingHashes?.has(contentHash)) {
    return {
      status: 'duplicate',
      fileName: file.name,
      contentHash,
    };
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error(`Workbook "${file.name}" does not contain any readable sheets.`);
  }

  if (preferredBroker === 'custom') {
    return {
      status: 'needs_mapping',
      fileName: file.name,
      contentHash,
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
      contentHash,
      workbook,
      suggestedBrokerLabel: 'Custom',
      reason:
        'Could not auto-detect Groww, Zerodha, or INDmoney template headers. Map the columns below to import.',
    };
  }

  try {
    const sourceId = createSourceId(selectedParser.brokerType);
    const parsed = selectedParser.parse(workbook, sourceId);
    return {
      status: 'parsed',
      source: {
        ...parsed,
        contentHash,
      },
    };
  } catch (err) {
    if (err instanceof ParserTemplateMismatchError && err.canFallbackToMapper) {
      return {
        status: 'needs_mapping',
        fileName: file.name,
        contentHash,
        workbook,
        suggestedBrokerLabel: selectedParser.displayName,
        reason: err.message,
      };
    }
    throw err;
  }
}
