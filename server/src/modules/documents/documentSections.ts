import { computeSha256 } from '../../common/crypto.js';

/**
 * E11-T3: split the text of a document version into sections.
 *
 * Pure and deterministic: no database, no network, no model. The same text always gives the same sections.
 *
 * Offsets are positions in the JavaScript string exactly as it is stored in
 * document_versions.extracted_content (UTF-16 code units, the unit of String.prototype.slice), so
 * `text.slice(charStart, charEnd)` is the section. Sections are ordered, do not overlap and cover the
 * whole text.
 *
 * Rules:
 * - A section starts at each ATX heading line (`#` to `######`) outside a fenced code block and runs up to
 *   the next heading of any level. Sections are flat: a parent heading does not contain its children.
 * - Text before the first heading is a section of level 0 with an empty heading path. When that text is
 *   only whitespace it is not a section of its own; it belongs to the first heading's section.
 * - A text without any heading is split on paragraphs (blocks separated by blank lines, a fenced code block
 *   is never split). Each paragraph section includes the blank lines that follow it.
 * - Empty text gives no section.
 *
 * Not recognised as headings: Setext headings (a line underlined with === or ---), HTML headings, and bold
 * lines used as titles. Only "\n" and "\r\n" end a line.
 */

export interface SectionDraft {
  /** Titles of the ancestor headings down to the section's own heading; empty for level 0 */
  headingPath: string[];
  /** 1-6 for a heading section, 0 for text before the first heading and for paragraph sections */
  level: number;
  /** Position of the section in the text, from 0 */
  orderNo: number;
  charStart: number;
  charEnd: number;
  /** `sha256:<hex>` of the section text, see sectionContentHash */
  contentHash: string;
  /** Identity of the section across versions, unique within one version. See stableKeyFor* below. */
  stableKey: string;
}

const KEY_HEX_LENGTH = 16;

/** Unicode NFC, whitespace collapsed, trimmed, lower-cased. Diacritics are kept. */
export function normaliseForKey(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Key of a heading section: depends only on the normalised heading path, never on position or content. */
export function stableKeyForHeadingPath(headingPath: string[]): string {
  return `h-${computeSha256(JSON.stringify(headingPath.map(normaliseForKey))).slice(0, KEY_HEX_LENGTH)}`;
}

/** Key of a paragraph section in a text without headings: depends only on the normalised paragraph text. */
export function stableKeyForParagraph(paragraphText: string): string {
  return `p-${computeSha256(normaliseForKey(paragraphText)).slice(0, KEY_HEX_LENGTH)}`;
}

/** Key of the text before the first heading */
export const PREAMBLE_STABLE_KEY = 'preamble';

/**
 * Hash of a section's text with line endings normalised to "\n" and trailing whitespace removed.
 * The blank lines that separate a section from the next one are not its content: without removing them, a
 * section moved from the end of a document to the middle would get another hash although nobody edited it.
 */
export function sectionContentHash(sectionText: string): string {
  return `sha256:${computeSha256(sectionText.replace(/\r\n?/g, '\n').trimEnd())}`;
}

interface HeadingLine {
  offset: number;
  level: number;
  title: string;
}

const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING_PATTERN = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;

function headingTitle(raw: string | undefined): string {
  const title = (raw ?? '').trim();
  // Drop an optional closing sequence: "## Title ##" -> "Title", "## ##" -> ""
  let end = title.length;
  while (end > 0 && title[end - 1] === '#') end--;
  if (end === 0) return '';
  if (end < title.length && (title[end - 1] === ' ' || title[end - 1] === '\t')) {
    return title.slice(0, end).trimEnd();
  }
  return title;
}

/**
 * One pass over the lines. Returns the heading lines and, for texts without headings, the offsets where a
 * paragraph starts (a non-blank line that follows a blank line, outside a fenced code block).
 */
function scanLines(text: string): { headings: HeadingLine[]; paragraphStarts: number[] } {
  const headings: HeadingLine[] = [];
  const paragraphStarts: number[] = [];
  let fence: { char: string; length: number } | null = null;
  let previousBlank = false;
  let seenContent = false;
  let pos = 0;

  while (pos < text.length) {
    const newline = text.indexOf('\n', pos);
    const next = newline === -1 ? text.length : newline + 1;
    let lineEnd = newline === -1 ? text.length : newline;
    if (lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) lineEnd--;
    const line = text.slice(pos, lineEnd);
    const blank = !/\S/.test(line);

    if (fence) {
      const close = FENCE_PATTERN.exec(line);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length && close[2].trim() === '') {
        fence = null;
      }
      previousBlank = false;
    } else {
      if (!blank && previousBlank && seenContent) paragraphStarts.push(pos);
      const open = FENCE_PATTERN.exec(line);
      if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
        fence = { char: open[1][0], length: open[1].length };
      } else {
        const heading = HEADING_PATTERN.exec(line);
        if (heading) headings.push({ offset: pos, level: heading[1].length, title: headingTitle(heading[2]) });
      }
      previousBlank = blank;
    }
    if (!blank) seenContent = true;
    pos = next;
  }

  return { headings, paragraphStarts };
}

export function splitIntoSections(text: string | null | undefined): SectionDraft[] {
  if (!text) return [];

  const { headings, paragraphStarts } = scanLines(text);
  const sections: SectionDraft[] = [];
  const seenKeys = new Map<string, number>();

  const push = (charStart: number, charEnd: number, level: number, headingPath: string[], baseKey: string | null) => {
    const sectionText = text.slice(charStart, charEnd);
    const key = baseKey ?? stableKeyForParagraph(sectionText);
    // The same key more than once in a version: the 2nd, 3rd... occurrence in document order gets "-2", "-3"...
    const occurrence = (seenKeys.get(key) ?? 0) + 1;
    seenKeys.set(key, occurrence);
    sections.push({
      headingPath,
      level,
      orderNo: sections.length,
      charStart,
      charEnd,
      contentHash: sectionContentHash(sectionText),
      stableKey: occurrence === 1 ? key : `${key}-${occurrence}`
    });
  };

  if (headings.length === 0) {
    const starts = [0, ...paragraphStarts];
    for (let i = 0; i < starts.length; i++) {
      push(starts[i], i + 1 < starts.length ? starts[i + 1] : text.length, 0, [], null);
    }
    return sections;
  }

  const firstHeadingOffset = headings[0].offset;
  const hasPreamble = firstHeadingOffset > 0 && /\S/.test(text.slice(0, firstHeadingOffset));
  if (hasPreamble) {
    push(0, firstHeadingOffset, 0, [], PREAMBLE_STABLE_KEY);
  }

  const ancestors: HeadingLine[] = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    while (ancestors.length > 0 && ancestors[ancestors.length - 1].level >= heading.level) ancestors.pop();
    ancestors.push(heading);
    const headingPath = ancestors.map(a => a.title);
    const charStart = i === 0 && !hasPreamble ? 0 : heading.offset;
    const charEnd = i + 1 < headings.length ? headings[i + 1].offset : text.length;
    push(charStart, charEnd, heading.level, headingPath, stableKeyForHeadingPath(headingPath));
  }
  return sections;
}

export interface SectionPair<T> {
  stableKey: string;
  old: T;
  new: T;
}

export interface SectionMapping<T> {
  /** Same stable_key and same content_hash */
  unchanged: SectionPair<T>[];
  /** Same stable_key, different content_hash */
  changed: SectionPair<T>[];
  /** stable_key found only in the old version (removed, or its heading was renamed or moved under another parent) */
  onlyInOld: T[];
  /** stable_key found only in the new version */
  onlyInNew: T[];
}

/** Map the sections of two versions by stable_key. Position is ignored, so reordered sections still map. */
export function mapSections<T extends { stableKey: string; contentHash: string }>(oldSections: T[], newSections: T[]): SectionMapping<T> {
  const newByKey = new Map(newSections.map(s => [s.stableKey, s]));
  const oldKeys = new Set(oldSections.map(s => s.stableKey));
  const mapping: SectionMapping<T> = { unchanged: [], changed: [], onlyInOld: [], onlyInNew: [] };

  for (const oldSection of oldSections) {
    const newSection = newByKey.get(oldSection.stableKey);
    if (!newSection) {
      mapping.onlyInOld.push(oldSection);
    } else if (newSection.contentHash === oldSection.contentHash) {
      mapping.unchanged.push({ stableKey: oldSection.stableKey, old: oldSection, new: newSection });
    } else {
      mapping.changed.push({ stableKey: oldSection.stableKey, old: oldSection, new: newSection });
    }
  }
  for (const newSection of newSections) {
    if (!oldKeys.has(newSection.stableKey)) mapping.onlyInNew.push(newSection);
  }
  return mapping;
}

export interface SourceAnchor {
  charStart?: number | null;
  charEnd?: number | null;
  exactQuote?: string | null;
}

function sectionAt<T extends { charStart: number; charEnd: number }>(sections: T[], offset: number): T | null {
  let low = 0;
  let high = sections.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const section = sections[mid];
    if (offset < section.charStart) high = mid - 1;
    else if (offset >= section.charEnd) low = mid + 1;
    else return section;
  }
  return null;
}

/**
 * Find the section a knowledge source anchor belongs to. `sections` must be the ordered sections of `text`.
 *
 * 1. The offsets are used when they are a valid range of the text and, if a quote is given, the text at
 *    that range is exactly the quote. The section is the one that contains the start offset.
 * 2. Otherwise the quote is searched in the text. It is used when every occurrence starts in the same section.
 * 3. Otherwise null: no section is guessed.
 */
export function findSectionForAnchor<T extends { charStart: number; charEnd: number }>(
  text: string,
  sections: T[],
  anchor: SourceAnchor
): T | null {
  if (!text || sections.length === 0) return null;
  const quote = anchor.exactQuote ?? '';
  const start = anchor.charStart;
  const end = anchor.charEnd;

  const offsetsValid =
    typeof start === 'number' && typeof end === 'number' &&
    Number.isInteger(start) && Number.isInteger(end) &&
    start >= 0 && end > start && end <= text.length;
  if (offsetsValid && (quote === '' || text.slice(start, end) === quote)) {
    return sectionAt(sections, start);
  }

  if (quote === '') return null;
  let found: T | null = null;
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    const section = sectionAt(sections, at);
    if (!section) return null;
    if (found && found !== section) return null;
    found = section;
  }
  return found;
}
