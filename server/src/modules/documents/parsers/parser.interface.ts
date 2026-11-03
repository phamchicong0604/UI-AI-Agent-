export interface ParsedHeading {
  text: string;
  level: number;
  offset: number;
}

export interface ParseResult {
  rawText: string;
  markdownText: string;
  headings: ParsedHeading[];
  warnings: string[];
  hasTextLayer: boolean;
  metadata?: Record<string, any>;
}

export interface IDocumentParser {
  canParse(mimeType: string, filename: string): boolean;
  parse(buffer: Buffer, filename: string): Promise<ParseResult>;
}
