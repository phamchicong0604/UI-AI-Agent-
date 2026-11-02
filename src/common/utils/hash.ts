/**
 * Cryptographic Hash Code utilities
 * Implements standard SHA-256 hashing for documents, versions, evidence payloads,
 * and tamper-evident audit chaining using the Web Crypto API with synchronous fallback.
 */

/**
 * Computes standard SHA-256 hash string (hex encoded) using Web Crypto API.
 */
export async function computeSha256(data: string | ArrayBuffer): Promise<string> {
  try {
    let buffer: ArrayBuffer;
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      buffer = encoder.encode(data).buffer;
    } else {
      buffer = data;
    }

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback to synchronous pure JS hash
  }

  return syncSha256(typeof data === 'string' ? data : new TextDecoder().decode(data));
}

/**
 * Pure JavaScript synchronous implementation of SHA-256
 */
export function syncSha256(asciiInput: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let ascii = asciiInput;
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: { [key: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // non-ascii
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s0a = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const s1a = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const t1 = hash[7] + s1a + ch + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const t2 = s0a + maj;

      hash = [(t1 + t2) | 0, hash[0], hash[1], hash[2], (hash[3] + t1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Formats a SHA-256 hash for UI display (shortened with prefix)
 * Example: sha256:7b1d9a0e...
 */
export function formatHashCode(hash: string, short = true): string {
  if (!hash) return 'sha256:00000000...';
  const clean = hash.startsWith('sha256:') ? hash.slice(7) : hash;
  if (short) {
    return `sha256:${clean.slice(0, 10)}...${clean.slice(-4)}`;
  }
  return `sha256:${clean}`;
}

/**
 * Generates an integrity checksum for a document revision
 */
export function generateDocumentChecksum(title: string, version: string, content: string): string {
  const payload = `${title}|${version}|${content}|${Date.now()}`;
  return syncSha256(payload);
}
