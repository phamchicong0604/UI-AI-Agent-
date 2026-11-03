import AdmZip from 'adm-zip';
import path from 'path';
import { IDocumentParser, ParseResult, ParsedHeading } from './parser.interface.js';

export class DocxParser implements IDocumentParser {
  public canParse(mimeType: string, filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return (
      ext === '.docx' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  }

  public async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const zip = new AdmZip(buffer);
    const docEntry = zip.getEntry('word/document.xml');

    if (!docEntry) {
      throw new Error('Invalid DOCX package: word/document.xml not found.');
    }

    // Safety guard against massive XML expansion (BUG-009)
    if (docEntry.header.size > 100 * 1024 * 1024) {
      throw new Error('DOCX document.xml exceeds maximum safe uncompressed size (100MB).');
    }

    const xml = zip.readAsText(docEntry);

    // Extract all paragraphs <w:p>...</w:p>
    const paragraphRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
    const styleRegex = /<w:pStyle\s+[^>]*w:val="([^"]+)"/i;
    const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;

    const markdownLines: string[] = [];
    const headings: ParsedHeading[] = [];
    let currentOffset = 0;

    let pMatch: RegExpExecArray | null;

    while ((pMatch = paragraphRegex.exec(xml)) !== null) {
      const pContent = pMatch[1];

      // Extract style (Heading 1, 2, 3...)
      const styleMatch = pContent.match(styleRegex);
      const styleVal = styleMatch ? styleMatch[1].toLowerCase() : '';

      // Extract text content inside <w:t>
      const textPieces: string[] = [];
      let tMatch: RegExpExecArray | null;
      while ((tMatch = textRegex.exec(pContent)) !== null) {
        // Decode XML entities &amp;, &lt;, &gt;, &quot;
        const decoded = tMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        textPieces.push(decoded);
      }

      const pText = textPieces.join('').trim();
      if (!pText) continue;

      let formattedLine = pText;
      let headingLevel = 0;

      if (styleVal.includes('heading1') || styleVal.includes('heading 1') || styleVal === 'title') {
        headingLevel = 1;
        formattedLine = `# ${pText}`;
      } else if (styleVal.includes('heading2') || styleVal.includes('heading 2')) {
        headingLevel = 2;
        formattedLine = `## ${pText}`;
      } else if (styleVal.includes('heading3') || styleVal.includes('heading 3')) {
        headingLevel = 3;
        formattedLine = `### ${pText}`;
      } else if (styleVal.includes('heading4') || styleVal.includes('heading 4')) {
        headingLevel = 4;
        formattedLine = `#### ${pText}`;
      }

      if (headingLevel > 0) {
        headings.push({
          text: pText,
          level: headingLevel,
          offset: currentOffset
        });
      }

      markdownLines.push(formattedLine);
      currentOffset += formattedLine.length + 2; // \n\n
    }

    const markdownText = markdownLines.join('\n\n');
    const rawText = markdownLines.map(l => l.replace(/^#+\s*/, '')).join('\n\n');

    return {
      rawText,
      markdownText,
      headings,
      warnings: [],
      hasTextLayer: true,
      metadata: {
        format: 'docx',
        paragraphCount: markdownLines.length,
        charCount: markdownText.length
      }
    };
  }
}
