import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { validateFileContent, validateZipArchive, UPLOAD_LIMITS } from '../modules/documents/uploadSecurity.js';

describe('Upload Security & Hardening (E2-T1)', () => {
  it('should accept valid markdown, text and json files', () => {
    const mdBuffer = Buffer.from('# Clean Markdown Document\n\nValid text content.', 'utf-8');
    const res = validateFileContent('spec.md', mdBuffer);
    expect(res.isValid).toBe(true);

    const jsonBuffer = Buffer.from('{"key": "value"}', 'utf-8');
    const resJson = validateFileContent('config.json', jsonBuffer);
    expect(resJson.isValid).toBe(true);
  });

  it('should reject disallowed extensions (.exe, .sh, .bin) with 415', () => {
    const buffer = Buffer.from('#!/bin/bash\necho "hello"', 'utf-8');
    const res = validateFileContent('script.sh', buffer);
    expect(res.isValid).toBe(false);
    expect(res.statusCode).toBe(415);
    expect(res.error).toContain('.sh');

    const resExe = validateFileContent('payload.exe', Buffer.from('MZ...'));
    expect(resExe.isValid).toBe(false);
    expect(resExe.statusCode).toBe(415);
  });

  it('should reject binary files masked with a .md extension', () => {
    // Binary payload with null bytes disguised as .md
    const fakeMd = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x01, 0x02, 0xff]);
    const res = validateFileContent('sneaky.md', fakeMd);
    expect(res.isValid).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toContain('byte null');
  });

  it('should validate PDF magic numbers and reject corrupt or fake PDFs', () => {
    const validPdfHeader = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj');
    const resValid = validateFileContent('document.pdf', validPdfHeader);
    expect(resValid.isValid).toBe(true);

    const fakePdf = Buffer.from('NOT A PDF FILE TEXT DATA');
    const resFake = validateFileContent('document.pdf', fakePdf);
    expect(resFake.isValid).toBe(false);
    expect(resFake.statusCode).toBe(400);
    expect(resFake.error).toContain('%PDF-');
  });

  it('should detect and block path traversal attempts inside ZIP archives', () => {
    const zip = new AdmZip();
    zip.addFile('placeholder.txt', Buffer.from('root:x:0:0:...'));
    zip.getEntries()[0].entryName = '../../etc/shadow';

    const zipBuffer = zip.toBuffer();
    const res = validateZipArchive(zipBuffer);

    expect(res.isValid).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toContain('Path Traversal');
  });

  it('should detect and block zip archives containing absolute path entries', () => {
    const zip = new AdmZip();
    zip.addFile('placeholder.txt', Buffer.from('dangerous binary'));
    zip.getEntries()[0].entryName = '/usr/local/bin/malicious';

    const zipBuffer = zip.toBuffer();
    const res = validateZipArchive(zipBuffer);

    expect(res.isValid).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toContain('Path Traversal');
  });

  it('should block archives exceeding maximum entry count limit', () => {
    const zip = new AdmZip();
    for (let i = 0; i < UPLOAD_LIMITS.MAX_ZIP_ENTRIES + 5; i++) {
      zip.addFile(`file_${i}.txt`, Buffer.from('x'));
    }

    const res = validateZipArchive(zip.toBuffer());
    expect(res.isValid).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toContain('quá nhiều tệp con');
  });
});
