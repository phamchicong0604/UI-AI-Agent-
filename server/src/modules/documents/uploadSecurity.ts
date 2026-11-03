import AdmZip from 'adm-zip';
import path from 'path';

export interface SecurityCheckResult {
  isValid: boolean;
  error?: string;
  statusCode?: number;
}

export const UPLOAD_LIMITS = {
  MAX_SINGLE_FILE_SIZE: 50 * 1024 * 1024,      // 50 MB
  MAX_ZIP_ENTRIES: 500,                         // Max entries in archive
  MAX_ZIP_TOTAL_UNCOMPRESSED: 100 * 1024 * 1024, // 100 MB uncompressed limit
  MAX_ZIP_COMPRESSION_RATIO: 50                // Ratio > 50:1 flagged as zip bomb
};

export const ALLOWED_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.docx', '.pdf', '.zip', '.json', '.yaml', '.yml'
]);

const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.bin', '.sh', '.bat', '.cmd', '.vbs', '.py', '.rb',
  '.php', '.jar', '.apk', '.dmg', '.pkg', '.elf', '.msi', '.svg', '.js', '.htm', '.html', '.ps1'
]);

/**
 * Validates single file buffer for MIME magic numbers, content safety and binary masking
 */
export function validateFileContent(originalName: string, buffer: Buffer): SecurityCheckResult {
  // 1. Size check
  if (buffer.length > UPLOAD_LIMITS.MAX_SINGLE_FILE_SIZE) {
    return {
      isValid: false,
      error: `Kích thước tệp vượt quá giới hạn cho phép (${(UPLOAD_LIMITS.MAX_SINGLE_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB).`,
      statusCode: 413
    };
  }

  // 2. Extension Whitelist (BUG-031) & Blacklist check
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Định dạng tệp "${ext}" không được hỗ trợ hoặc bị chặn vì lý do an toàn bảo mật.`,
      statusCode: 415
    };
  }
  if (DISALLOWED_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Định dạng tệp "${ext}" bị chặn vì lý do an toàn bảo mật.`,
      statusCode: 415
    };
  }

  // 3. Magic number inspection
  // Case A: PDF Magic Byte: %PDF-
  if (ext === '.pdf') {
    const isPdfMagic = buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
    if (!isPdfMagic) {
      return {
        isValid: false,
        error: 'Tệp PDF không hợp lệ (sai magic header %PDF-).',
        statusCode: 400
      };
    }
    return { isValid: true };
  }

  // Case B: ZIP Archive
  if (ext === '.zip') {
    const isZipMagic = buffer.length >= 4 &&
      buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZipMagic) {
      return {
        isValid: false,
        error: 'Tệp ZIP không hợp lệ (sai magic header PK\\x03\\x04).',
        statusCode: 400
      };
    }
    // Inspect contents of the zip
    return validateZipArchive(buffer);
  }

  // Case C: DOCX File (ZIP package containing word/ or [Content_Types].xml)
  if (ext === '.docx') {
    const isZipMagic = buffer.length >= 4 &&
      buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZipMagic) {
      return {
        isValid: false,
        error: 'Tệp DOCX không hợp lệ (không phải là gói OpenXML hợp lệ).',
        statusCode: 400
      };
    }

    // BUG-009: DOCX files are zip archives and must undergo full archive & zip bomb inspection
    const archiveCheck = validateZipArchive(buffer);
    if (!archiveCheck.isValid) {
      return archiveCheck;
    }

    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const hasWordDoc = entries.some(e => e.entryName.startsWith('word/') || e.entryName === '[Content_Types].xml');
      if (!hasWordDoc) {
        return {
          isValid: false,
          error: 'Tệp DOCX không chứa cấu trúc WordDocument chuẩn.',
          statusCode: 400
        };
      }
    } catch (err: any) {
      return {
        isValid: false,
        error: `Không thể đọc cấu trúc tệp DOCX: ${err.message}`,
        statusCode: 400
      };
    }
    return { isValid: true };
  }

  // Case D: Text / Markdown / JSON / HTML / YAML
  if (['.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.html'].includes(ext)) {
    // Check for null bytes in initial sample (indicates binary or executable disguised as text)
    const sampleSize = Math.min(buffer.length, 8192);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0x00) {
        return {
          isValid: false,
          error: `Tệp văn bản "${originalName}" chứa mã nhị phân không hợp lệ (phát hiện byte null).`,
          statusCode: 400
        };
      }
    }
    return { isValid: true };
  }

  // Allow general text files if no null bytes
  const sampleSize = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0x00) {
      return {
        isValid: false,
        error: `Định dạng tệp "${ext}" không được hỗ trợ hoặc chứa mã nhị phân không an toàn.`,
        statusCode: 415
      };
    }
  }

  return { isValid: true };
}

/**
 * Deep inspection of ZIP archives: checks zip bomb, entry limits, total size and path traversal
 */
export function validateZipArchive(buffer: Buffer): SecurityCheckResult {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (err: any) {
    return {
      isValid: false,
      error: `Tệp nén ZIP bị hỏng hoặc không thể giải mã: ${err.message}`,
      statusCode: 400
    };
  }

  const entries = zip.getEntries();

  // 1. Check entry count
  if (entries.length > UPLOAD_LIMITS.MAX_ZIP_ENTRIES) {
    return {
      isValid: false,
      error: `Tệp ZIP chứa quá nhiều tệp con (${entries.length} > giới hạn ${UPLOAD_LIMITS.MAX_ZIP_ENTRIES}).`,
      statusCode: 400
    };
  }

  let totalUncompressed = 0;

  for (const entry of entries) {
    const entryName = entry.entryName;

    // 2. Path Traversal check
    if (
      entryName.includes('..') ||
      entryName.startsWith('/') ||
      entryName.startsWith('\\') ||
      /^[a-zA-Z]:/.test(entryName)
    ) {
      return {
        isValid: false,
        error: `Phát hiện đường dẫn không an toàn (Path Traversal attempt) trong file nén: "${entryName}".`,
        statusCode: 400
      };
    }

    // 3. Compression ratio check (Zip Bomb Protection)
    const uncompressedSize = entry.header.size;
    const compressedSize = entry.header.compressedSize;

    if (uncompressedSize > UPLOAD_LIMITS.MAX_ZIP_TOTAL_UNCOMPRESSED) {
      return {
        isValid: false,
        error: `Tệp con "${entryName}" vượt quá dung lượng giải nén an toàn (${(UPLOAD_LIMITS.MAX_ZIP_TOTAL_UNCOMPRESSED / (1024 * 1024)).toFixed(0)}MB).`,
        statusCode: 413
      };
    }

    if (compressedSize > 0) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > UPLOAD_LIMITS.MAX_ZIP_COMPRESSION_RATIO && uncompressedSize > 1024 * 1024) {
        return {
          isValid: false,
          error: `Phát hiện rủi ro tấn công Zip Bomb trong tệp "${entryName}" (tỷ lệ nén bất thường: ${ratio.toFixed(0)}:1).`,
          statusCode: 400
        };
      }
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > UPLOAD_LIMITS.MAX_ZIP_TOTAL_UNCOMPRESSED) {
      return {
        isValid: false,
        error: `Tổng dung lượng sau giải nén vượt quá giới hạn an toàn (${(UPLOAD_LIMITS.MAX_ZIP_TOTAL_UNCOMPRESSED / (1024 * 1024)).toFixed(0)}MB).`,
        statusCode: 413
      };
    }
  }

  return { isValid: true };
}
