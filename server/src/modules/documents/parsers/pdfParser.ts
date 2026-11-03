import path from 'path';
import { PDFParse } from 'pdf-parse';
import { IDocumentParser, ParseResult, ParsedHeading } from './parser.interface.js';

export class PdfParser implements IDocumentParser {
  public canParse(mimeType: string, filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.pdf' || mimeType === 'application/pdf';
  }

  public async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    let rawText = '';
    const warnings: string[] = [];

    try {
      const parser = new PDFParse({ data: buffer });
      const extracted = await parser.getText();
      rawText = typeof extracted === 'string' ? extracted : (extracted?.text || '');
      await parser.destroy();
    } catch (err: any) {
      warnings.push(`PDF_PARSER_WARNING: ${err.message}`);
    }

    const trimmedText = rawText.trim();

    // Check if PDF has a text layer (E2-T3.3)
    if (!trimmedText || trimmedText.length < 10) {
      warnings.push('NEEDS_OCR');
      return {
        rawText: '',
        markdownText: `> ⚠️ **Cảnh báo (NEEDS_OCR)**: Tệp PDF "${filename}" không có lớp văn bản (text layer) khả dụng hoặc là bản quét (scan). Cần xử lý OCR ở giai đoạn mở rộng (P2).\n`,
        headings: [],
        warnings,
        hasTextLayer: false,
        metadata: {
          format: 'pdf',
          needsOcr: true,
          byteLength: buffer.length
        }
      };
    }

    // Extract headings from text lines
    const lines = rawText.split('\n');
    const headings: ParsedHeading[] = [];
    const markdownLines: string[] = [];
    let currentOffset = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        markdownLines.push('');
        currentOffset += 1;
        continue;
      }

      // Detect heading patterns:
      // Level 1: "1. Heading", "Chương 1", "Section 1", or ALL CAPS short line
      // Level 2: "1.1 Heading", "1.2 Heading"
      // Level 3: "1.1.1 Heading"
      let headingLevel = 0;
      let cleanText = line;

      if (/^(\d+\.\d+\.\d+)\s+(.+)$/.test(line)) {
        headingLevel = 3;
        cleanText = line;
      } else if (/^(\d+\.\d+)\s+(.+)$/.test(line)) {
        headingLevel = 2;
        cleanText = line;
      } else if (/^(\d+\.|\b(Chương|Section|Phần)\s+\d+[:.]?)\s+(.+)$/i.test(line)) {
        headingLevel = 1;
        cleanText = line;
      } else if (line.length < 60 && line.length > 3 && line === line.toUpperCase() && !/[.;,]$/.test(line)) {
        headingLevel = 2;
        cleanText = line;
      }

      if (headingLevel > 0) {
        headings.push({
          text: cleanText,
          level: headingLevel,
          offset: currentOffset
        });
        const prefix = '#'.repeat(headingLevel);
        markdownLines.push(`${prefix} ${cleanText}`);
      } else {
        markdownLines.push(line);
      }

      currentOffset += line.length + 1;
    }

    const markdownText = markdownLines.join('\n');

    return {
      rawText,
      markdownText,
      headings,
      warnings,
      hasTextLayer: true,
      metadata: {
        format: 'pdf',
        lineCount: lines.length,
        charCount: rawText.length,
        needsOcr: false
      }
    };
  }
}
