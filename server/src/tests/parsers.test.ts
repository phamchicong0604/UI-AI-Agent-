import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { MarkdownAndTextParser } from '../modules/documents/parsers/markdownParser.js';
import { DocxParser } from '../modules/documents/parsers/docxParser.js';
import { PdfParser } from '../modules/documents/parsers/pdfParser.js';
import { documentParserManager } from '../modules/documents/parsers/index.js';

describe('Document Parsers (E2-T3)', () => {
  it('should parse markdown and extract heading hierarchy with character offsets', async () => {
    const parser = new MarkdownAndTextParser();
    const md = `# Title One\n\nParagraph text.\n\n## Section 1.1\n\nMore details.\n\n### Sub-section\n\nNotes.`;
    const buffer = Buffer.from(md, 'utf-8');

    const result = await parser.parse(buffer, 'spec.md');

    expect(result.hasTextLayer).toBe(true);
    expect(result.headings.length).toBe(3);
    expect(result.headings[0]).toEqual({ text: 'Title One', level: 1, offset: 0 });
    expect(result.headings[1].text).toBe('Section 1.1');
    expect(result.headings[1].level).toBe(2);
    expect(result.headings[2].text).toBe('Sub-section');
    expect(result.headings[2].level).toBe(3);
  });

  it('should parse docx XML package, preserving headings and text', async () => {
    const parser = new DocxParser();

    // Construct valid minimal DOCX zip package
    const zip = new AdmZip();
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>System Overview Spec</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is an introductory paragraph for testing.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Security Architecture</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Detailed encryption and HMAC authentication guidelines.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.addFile('word/document.xml', Buffer.from(docXml, 'utf-8'));
    const buffer = zip.toBuffer();

    const result = await parser.parse(buffer, 'architecture.docx');

    expect(result.hasTextLayer).toBe(true);
    expect(result.headings.length).toBe(2);
    expect(result.headings[0].text).toBe('System Overview Spec');
    expect(result.headings[0].level).toBe(1);
    expect(result.headings[1].text).toBe('Security Architecture');
    expect(result.headings[1].level).toBe(2);
    expect(result.markdownText).toContain('# System Overview Spec');
    expect(result.markdownText).toContain('## Security Architecture');
  });

  it('should flag PDF without text layer as NEEDS_OCR and disable AI processing', async () => {
    const parser = new PdfParser();
    // A scanned or empty PDF representation
    const emptyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF');

    const result = await parser.parse(emptyPdf, 'scanned_contract.pdf');

    expect(result.hasTextLayer).toBe(false);
    expect(result.warnings).toContain('NEEDS_OCR');
    expect(result.markdownText).toContain('NEEDS_OCR');
  });

  it('should route formats correctly via DocumentParserManager', async () => {
    const textBuffer = Buffer.from('# Hello World', 'utf-8');
    const res = await documentParserManager.parse(textBuffer, 'readme.txt', 'text/plain');
    expect(res.hasTextLayer).toBe(true);
    expect(res.headings[0].text).toBe('Hello World');
  });
});
