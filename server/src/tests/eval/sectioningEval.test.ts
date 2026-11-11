import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitIntoSections, mapSections, SectionDraft } from '../../modules/documents/documentSections.js';

/**
 * Measurement of the sectioning function (E11-T3) on the repository's own Markdown documents.
 * Pure function only: no database, no route. Always runs as a regression guard; when SECTIONING_EVAL_OUT is
 * set it also writes every row to that file for the eval report.
 *
 * What this does and does not show:
 *  - Part 1 checks structural invariants (every character in exactly one section, keys unique per document).
 *    They hold by construction, also for a text whose headings were recognised wrongly, so they say nothing
 *    about whether the right lines were taken as headings. There are no labels for that here.
 *  - Part 2 builds a second version of a document by program and maps the two. The expected counts are the
 *    assertions below, written from the stable_key rule before running. Two of the four edits are cases the
 *    rule handles well, two are its documented limits (a renamed heading, a duplicate heading path).
 *  - The documents are clean ATX Markdown written by this team: no BOM, CRLF, Setext, duplicate heading paths,
 *    PDF or DOCX. This is a development set, not evidence about user documents.
 */
const OUT = process.env.SECTIONING_EVAL_OUT;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const documentFiles = (): string[] => {
  const docsDir = path.join(REPO_ROOT, 'docs');
  const docs = fs.existsSync(docsDir) ? fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).sort().map(f => `docs/${f}`) : [];
  return [...(fs.existsSync(path.join(REPO_ROOT, 'README.md')) ? ['README.md'] : []), ...docs];
};

const coverageHolds = (text: string, sections: SectionDraft[]): boolean => {
  let at = 0;
  for (const s of sections) {
    if (s.charStart !== at || s.charEnd <= s.charStart) return false;
    at = s.charEnd;
  }
  return at === text.length;
};

interface Blocks {
  prefix: string;
  blocks: string[];
  /** Number of sections in each block */
  sizes: number[];
}

/** Cuts a document into its top-level blocks: the shallowest heading level that occurs at least 3 times */
function topLevelBlocks(text: string, sections: SectionDraft[]): Blocks | null {
  for (let level = 1; level <= 6; level++) {
    const starts = sections.filter(s => s.level === level);
    if (starts.length < 3) continue;
    // A block must not be interrupted by a shallower heading, otherwise moving it would change its parent
    const firstIndex = sections.indexOf(starts[0]);
    if (sections.slice(firstIndex).some(s => s.level < level)) return null;
    const blocks: string[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < starts.length; i++) {
      const from = starts[i].charStart;
      const to = i + 1 < starts.length ? starts[i + 1].charStart : text.length;
      const block = text.slice(from, to);
      blocks.push(block.endsWith('\n') ? block : `${block}\n`);
      sizes.push(sections.filter(s => s.charStart >= from && s.charStart < to).length);
    }
    return { prefix: text.slice(0, starts[0].charStart), blocks, sizes };
  }
  return null;
}

const join = (b: Blocks, blocks: string[]) => b.prefix + blocks.join('');
const counts = (oldText: string, newText: string) => {
  const m = mapSections(splitIntoSections(oldText), splitIntoSections(newText));
  return { unchanged: m.unchanged.length, changed: m.changed.length, onlyOld: m.onlyInOld.length, onlyNew: m.onlyInNew.length };
};

describe('Eval: sectioning on the repository documents', () => {
  const files = documentFiles();
  const rows: Array<Record<string, unknown>> = [];
  const mappingRows: Array<Record<string, unknown>> = [];

  afterAll(() => {
    const totals = {
      files: rows.length,
      characters: rows.reduce((n, r) => n + (r.characters as number), 0),
      sections: rows.reduce((n, r) => n + (r.sections as number), 0),
      coverageOk: rows.filter(r => r.coverage).length,
      uniqueKeysOk: rows.filter(r => r.uniqueKeys).length,
      maxDepth: Math.max(0, ...rows.map(r => r.maxDepth as number)),
      filesWithMapping: mappingRows.length
    };
    console.log(`[sectioning eval] ${JSON.stringify(totals)}`);
    if (OUT) {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({ totals, files: rows, mapping: mappingRows }, null, 2));
    }
  });

  it('finds documents to measure', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('part 1, structural invariants: %s', (file) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
    const sections = splitIntoSections(text);
    const keys = new Set(sections.map(s => s.stableKey));
    const row = {
      file,
      characters: text.length,
      sections: sections.length,
      coverage: coverageHolds(text, sections),
      uniqueKeys: keys.size === sections.length,
      maxDepth: Math.max(0, ...sections.map(s => s.headingPath.length))
    };
    rows.push(row);
    expect(row.coverage).toBe(true);
    expect(row.uniqueKeys).toBe(true);
  });

  it.each(files)('part 2, two-version mapping: %s', (file) => {
    const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
    const sections = splitIntoSections(text);
    const b = topLevelBlocks(text, sections);
    if (!b) return; // fewer than 3 top-level blocks: not part of this measurement

    const v1 = join(b, b.blocks);
    const total = splitIntoSections(v1).length;
    const last = b.blocks.length - 1;
    const swapped = [b.blocks[1], b.blocks[0], ...b.blocks.slice(2)];
    const lastHeadingLine = b.blocks[last].slice(0, b.blocks[last].indexOf('\n'));

    // A. Reorder only: nothing was edited
    const reorder = counts(v1, join(b, swapped));
    // B. Reorder, and add one line to the body of the last block's own section
    const firstSectionEnd = splitIntoSections(b.blocks[last])[0].charEnd;
    const editedLast = `${b.blocks[last].slice(0, firstSectionEnd).trimEnd()}\nDòng được thêm để kiểm tra.\n\n${b.blocks[last].slice(firstSectionEnd)}`;
    const reorderAndEdit = counts(v1, join(b, [...swapped.slice(0, last), editedLast]));
    // C. Limit: rename the heading of the last block. Its key and the keys of everything below it change
    const renamedLast = `${lastHeadingLine} (đổi tên)${b.blocks[last].slice(lastHeadingLine.length)}`;
    const rename = counts(v1, join(b, [...b.blocks.slice(0, last), renamedLast]));
    // D. Limit: a new block with the same heading is inserted before the last block. The old key now points
    //    at the new text ("changed") and the untouched original shows up as only-new: a wrong pair, not flagged
    const duplicate = counts(v1, join(b, [...b.blocks.slice(0, last), `${lastHeadingLine}\nNội dung khác hẳn.\n\n`, b.blocks[last]]));

    mappingRows.push({ file, sections: total, sectionsInLastBlock: b.sizes[last], reorder, reorderAndEdit, rename, duplicate });

    expect(reorder).toEqual({ unchanged: total, changed: 0, onlyOld: 0, onlyNew: 0 });
    expect(reorderAndEdit).toEqual({ unchanged: total - 1, changed: 1, onlyOld: 0, onlyNew: 0 });
    expect(rename).toEqual({ unchanged: total - b.sizes[last], changed: 0, onlyOld: b.sizes[last], onlyNew: b.sizes[last] });
    expect(duplicate).toEqual({ unchanged: total - 1, changed: 1, onlyOld: 0, onlyNew: 1 });
  });
});
