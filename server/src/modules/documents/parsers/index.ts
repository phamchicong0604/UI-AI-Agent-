import { IDocumentParser, ParseResult } from './parser.interface.js';
import { MarkdownAndTextParser } from './markdownParser.js';
import { DocxParser } from './docxParser.js';
import { PdfParser } from './pdfParser.js';

export * from './parser.interface.js';
export * from './markdownParser.js';
export * from './docxParser.js';
export * from './pdfParser.js';

export class DocumentParserManager {
  private parsers: IDocumentParser[];

  constructor() {
    this.parsers = [
      new DocxParser(),
      new PdfParser(),
      new MarkdownAndTextParser() // fallback for text/md/json
    ];
  }

  public async parse(buffer: Buffer, filename: string, mimeType = ''): Promise<ParseResult> {
    for (const parser of this.parsers) {
      if (parser.canParse(mimeType, filename)) {
        return parser.parse(buffer, filename);
      }
    }

    // Default fallback to text parser
    const fallback = new MarkdownAndTextParser();
    return fallback.parse(buffer, filename);
  }
}

export const documentParserManager = new DocumentParserManager();
