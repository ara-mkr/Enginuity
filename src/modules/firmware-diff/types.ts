export type FileType = 'text' | 'HEX' | 'BIN' | 'ELF' | 'ZIP';

export interface ParsedFile {
  name: string;
  type: FileType;
  content: string; // Used for text, hex dump representation for HEX/BIN
  rawBuffer?: Uint8Array;
  hexData?: {
    bytes: Uint8Array;
    fullAddressBytes: (number | undefined)[];
    addressRanges: { start: number; end: number }[];
    totalSize: number;
    entryPoint: string;
    checksumValid: boolean;
  };
  binData?: {
    bytes: Uint8Array;
    totalSize: number;
    entropy: string;
    frequencies: number[];
  };
  elfData?: {
    totalSize: number;
    entryPoint: string;
    is64: string;
    endianness: string;
    architecture: string;
    sections: { index: number; type: string; address: string; size: string }[];
    error?: string;
  };
  zipFiles?: { name: string; content: string }[]; // Tree nodes for ZIP archives
}

export type DiffLineType = 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'MODIFIED';

export interface DiffChar {
  type: 'UNCHANGED' | 'ADDED' | 'REMOVED';
  char: string;
}

export interface DiffLine {
  type: DiffLineType;
  value?: string;
  valueA?: string;
  valueB?: string;
  lineA: number | null;
  lineB: number | null;
  charDiffA?: DiffChar[];
  charDiffB?: DiffChar[];
}

export interface Hunk {
  startA: number;
  startB: number;
  linesA: DiffLine[];
  linesB: DiffLine[];
  context: 'function_body' | 'header' | 'config' | 'unknown';
}

export interface DiffResult {
  lines: DiffLine[];
  hunks: Hunk[];
  stats: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    percentChanged: number;
    functionsAffected: string[];
  };
  binaryResult?: {
    changesCount: number;
    changedBytesTotal: number;
    diffDumpText: string;
    regions: { start: number; end: number; length: number }[];
  };
}

export interface AIChange {
  type: 'behavioral' | 'performance' | 'safety' | 'bug_fix' | 'refactor' | 'config' | 'dependency';
  description: string;
  severity: 'breaking' | 'significant' | 'minor' | 'cosmetic';
  lineRange: { start: number; end: number } | null;
  impact: string;
}

export interface AIRisk {
  description: string;
  severity: 'high' | 'medium' | 'low';
  relatedLines: number[];
}

export interface AIAnalysisResult {
  summary: string;
  changes: AIChange[];
  risks: AIRisk[];
  breaking_changes: string[];
  test_recommendations: string[];
  overall_risk: 'low' | 'medium' | 'high';
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  children?: FileTreeNode[];
}
