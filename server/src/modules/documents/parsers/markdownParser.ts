import path from 'path';
import { IDocumentParser, ParseResult, ParsedHeading } from './parser.interface.js';

export class MarkdownAndTextParser implements IDocumentParser {
  public canParse(mimeType: string, filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return (
      ['.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.html'].includes(ext) ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json'
    );
  }

  public async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const rawText = buffer.toString('utf-8');
    const lines = rawText.split('\n');
    const headings: ParsedHeading[] = [];

    let currentOffset = 0;

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        headings.push({
          text,
          level,
          offset: currentOffset
        });
      }
      currentOffset += line.length + 1; // +1 for \n
    }

    return {
      rawText,
      markdownText: rawText,
      headings,
      warnings: [],
      hasTextLayer: true,
      metadata: {
        lineCount: lines.length,
        charCount: rawText.length,
        format: path.extname(filename).toLowerCase().replace('.', '') || 'text'
      }
    };
  }
}
