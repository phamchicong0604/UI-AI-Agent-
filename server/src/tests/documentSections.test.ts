import { describe, it, expect } from 'vitest';
import {
  MAX_SECTIONS_PER_VERSION,
  MAX_TITLE_CHARS,
  SectionDraft,
  findSectionForAnchor,
  mapSections,
  normaliseForKey,
  sectionContentHash,
  splitIntoSections,
  stableKeyForHeadingPath,
  stableKeyForParagraph
} from '../modules/documents/documentSections.js';
import { computeSha256 } from '../common/crypto.js';

/** Ordered, no gap, no overlap, whole text covered, unique keys */
function expectCoverage(text: string, sections: SectionDraft[]) {
  let cursor = 0;
  sections.forEach((s, i) => {
    expect(s.orderNo).toBe(i);
    expect(s.charStart).toBe(cursor);
    expect(s.charEnd).toBeGreaterThan(s.charStart);
    cursor = s.charEnd;
  });
  expect(cursor).toBe(text.length);
  expect(sections.map(s => text.slice(s.charStart, s.charEnd)).join('')).toBe(text);
  expect(new Set(sections.map(s => s.stableKey)).size).toBe(sections.length);
}

const textOf = (text: string, s: SectionDraft) => text.slice(s.charStart, s.charEnd);
const byPath = (sections: SectionDraft[], ...path: string[]) => {
  const found = sections.filter(s => JSON.stringify(s.headingPath) === JSON.stringify(path));
  expect(found).toHaveLength(1);
  return found[0];
};

const VI_V1 = [
  'Tài liệu đặc tả cho phân hệ thanh toán.',
  '',
  '# Đặc tả yêu cầu',
  '',
  '## Mục tiêu',
  'Hệ thống phải xử lý hoàn tiền trong vòng 3 ngày làm việc.',
  '',
  '## Phạm vi',
  'Áp dụng cho khách hàng doanh nghiệp.',
  '',
  '### Ngoài phạm vi',
  'Không bao gồm thanh toán quốc tế.',
  '',
  '## Quy tắc nghiệp vụ',
  'Mỗi giao dịch bắt buộc có mã đối soát.',
  ''
].join('\n');

describe('E11-T3: splitIntoSections', () => {
  it('splits a Vietnamese document on its headings and keeps the heading path', () => {
    const sections = splitIntoSections(VI_V1);
    expectCoverage(VI_V1, sections);

    expect(sections.map(s => [s.level, s.headingPath])).toEqual([
      [0, []],
      [1, ['Đặc tả yêu cầu']],
      [2, ['Đặc tả yêu cầu', 'Mục tiêu']],
      [2, ['Đặc tả yêu cầu', 'Phạm vi']],
      [3, ['Đặc tả yêu cầu', 'Phạm vi', 'Ngoài phạm vi']],
      [2, ['Đặc tả yêu cầu', 'Quy tắc nghiệp vụ']]
    ]);
    expect(sections[0].stableKey).toBe('preamble');
    expect(textOf(VI_V1, sections[0])).toBe('Tài liệu đặc tả cho phân hệ thanh toán.\n\n');
    expect(textOf(VI_V1, byPath(sections, 'Đặc tả yêu cầu', 'Mục tiêu')))
      .toBe('## Mục tiêu\nHệ thống phải xử lý hoàn tiền trong vòng 3 ngày làm việc.\n\n');
    // Sections are flat: the parent stops where its first child starts
    expect(textOf(VI_V1, byPath(sections, 'Đặc tả yêu cầu'))).toBe('# Đặc tả yêu cầu\n\n');
  });

  it('is deterministic', () => {
    expect(splitIntoSections(VI_V1)).toEqual(splitIntoSections(VI_V1));
  });

  it('gives no section for empty text', () => {
    expect(splitIntoSections('')).toEqual([]);
    expect(splitIntoSections(null)).toEqual([]);
    expect(splitIntoSections(undefined)).toEqual([]);
  });

  it('handles a document that is only headings', () => {
    const text = '# A\n## B\n## C\n# D';
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections.map(s => textOf(text, s))).toEqual(['# A\n', '## B\n', '## C\n', '# D']);
    expect(sections.map(s => s.headingPath)).toEqual([['A'], ['A', 'B'], ['A', 'C'], ['D']]);
  });

  it('does not treat headings inside fenced code blocks as headings', () => {
    const text = [
      '# Real',
      '```bash',
      '# not a heading',
      '```',
      '~~~~',
      '## also not',
      '```',
      '# still inside the tilde fence',
      '~~~~',
      '## Second real',
      'text'
    ].join('\n');
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections.map(s => s.headingPath)).toEqual([['Real'], ['Real', 'Second real']]);
  });

  it('treats an unclosed fence as running to the end of the text', () => {
    const text = '# A\n```\n# inside\n## inside too\n';
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections).toHaveLength(1);
  });

  it('recognises ATX headings only in their valid forms', () => {
    const text = [
      '#NoSpace is not a heading',
      '   ### Indented three spaces ###',
      '    # Indented four spaces is code',
      '####### Seven hashes is not a heading',
      '#',
      '## Trailing hashes ##   ',
      '## C# language',
      'Setext is not recognised',
      '======================='
    ].join('\n');
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections.map(s => [s.level, s.headingPath[s.headingPath.length - 1] ?? null])).toEqual([
      [0, null],
      [3, 'Indented three spaces'],
      [1, ''],
      [2, 'Trailing hashes'],
      [2, 'C# language']
    ]);
  });

  it('keeps offsets exact with CRLF line endings and hashes independently of the line ending', () => {
    const lf = '# One\nfirst line\nsecond line\n\n## Two\nbody\n';
    const crlf = lf.replace(/\n/g, '\r\n');
    const a = splitIntoSections(lf);
    const b = splitIntoSections(crlf);
    expectCoverage(lf, a);
    expectCoverage(crlf, b);

    expect(b.map(s => s.headingPath)).toEqual([['One'], ['One', 'Two']]);
    expect(textOf(crlf, b[1])).toBe('## Two\r\nbody\r\n');
    expect(b.map(s => s.stableKey)).toEqual(a.map(s => s.stableKey));
    expect(b.map(s => s.contentHash)).toEqual(a.map(s => s.contentHash));
    // Line endings normalised and trailing whitespace removed before hashing
    expect(a[1].contentHash).toBe(`sha256:${computeSha256('## Two\nbody')}`);
    expect(sectionContentHash('a\r\nb\rc\n')).toBe(sectionContentHash('a\nb\nc\n'));
    expect(sectionContentHash('a\nb\n\n\n')).toBe(sectionContentHash('a\nb'));
    expect(sectionContentHash(' a\nb')).not.toBe(sectionContentHash('a\nb'));
  });

  it('puts leading blank lines into the first heading section instead of an empty preamble', () => {
    const text = '\n\n  \n# Title\nbody';
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ level: 1, headingPath: ['Title'], charStart: 0, charEnd: text.length });
  });

  it('pops the heading stack when the level goes back up, also when levels are skipped', () => {
    const text = '### Deep first\n# Top\n### Skipped level\n## Back\n# Other';
    expect(splitIntoSections(text).map(s => s.headingPath)).toEqual([
      ['Deep first'], ['Top'], ['Top', 'Skipped level'], ['Top', 'Back'], ['Other']
    ]);
  });

  it('counts offsets in UTF-16 code units, the unit of String.prototype.slice', () => {
    const text = '# 😀 Emoji\nđoạn 😀\n# Sau\nxong';
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(textOf(text, sections[1])).toBe('# Sau\nxong');
    expect(sections[1].charStart).toBe('# 😀 Emoji\nđoạn 😀\n'.length);
  });

  it('stays linear on a very large text', () => {
    const block = [
      '## Mục {n}', 'Nội dung của mục, có dấu tiếng Việt và một số dòng.', '', '```', '# trong khối mã', '```', '', 'Đoạn thứ hai của mục.', ''
    ].join('\n');
    const parts: string[] = ['# Tài liệu lớn\n'];
    for (let n = 0; n < 9000; n++) parts.push(block.replace('{n}', String(n)));
    const text = parts.join('');
    expect(text.length).toBeGreaterThan(900_000);

    const started = performance.now();
    const sections = splitIntoSections(text);
    const elapsed = performance.now() - started;

    expect(sections).toHaveLength(9001);
    expectCoverage(text, sections);
    // Generous bound: the measured time is a few tens of milliseconds; a quadratic scan would take minutes
    expect(elapsed).toBeLessThan(5000);
  });

  // A heading or fence line that cannot match must not be retried from every position: each of these inputs
  // made the earlier regular expressions backtrack quadratically (2 s at 40k characters, 51 s at 200k).
  it.each([
    ['spaces then a lone CR', (n: number) => `# ${' '.repeat(n)}\rx`],
    ['tabs then a lone CR', (n: number) => `# ${'\t'.repeat(n)}\rx`],
    ['spaces then U+2028', (n: number) => `# ${' '.repeat(n)}\u2028x`],
    ['a long fence marker then a lone CR', (n: number) => `${'`'.repeat(n)}\rx`],
    ['a long fence marker then U+2028', (n: number) => `${'~'.repeat(n)}\u2028x`]
  ])('takes linear time on a crafted line: %s', (_label, build) => {
    const time = (n: number) => {
      const text = build(n);
      const started = performance.now();
      const sections = splitIntoSections(text);
      const elapsed = performance.now() - started;
      expectCoverage(text, sections);
      return elapsed;
    };
    time(1_000); // warm-up
    const small = time(100_000);
    const large = time(400_000);
    // Quadratic growth would make the larger input about 16 times slower and take minutes
    expect(large).toBeLessThan(1_000);
    expect(large).toBeLessThan(Math.max(small, 1) * 10);
  });

  it('treats a lone CR as a line break, as the content hash does', () => {
    const lf = '# Tài liệu\n\n## Mục tiêu\nNội dung.\n';
    const cr = lf.replace(/\n/g, '\r');
    const fromLf = splitIntoSections(lf);
    const fromCr = splitIntoSections(cr);
    expectCoverage(cr, fromCr);
    expect(fromCr.map(s => s.headingPath)).toEqual([['Tài liệu'], ['Tài liệu', 'Mục tiêu']]);
    expect(fromCr.map(s => s.stableKey)).toEqual(fromLf.map(s => s.stableKey));
    expect(fromCr.map(s => s.contentHash)).toEqual(fromLf.map(s => s.contentHash));
  });

  it('ignores headings on request and splits on paragraphs instead', () => {
    const text = '# Title\nBody.\n\n## Part\nMore.\n';
    const sections = splitIntoSections(text, { headings: false });
    expectCoverage(text, sections);
    expect(sections.map(s => s.level)).toEqual([0, 0]);
    expect(sections.every(s => s.stableKey.startsWith('p-'))).toBe(true);
  });

  it('gives the same content hash for NFC and NFD text and with or without a byte order mark', () => {
    const body = '## Mục tiêu\nNội dung tiếng Việt có dấu.\n';
    expect(body.normalize('NFD')).not.toBe(body.normalize('NFC'));
    expect(sectionContentHash(body.normalize('NFD'))).toBe(sectionContentHash(body.normalize('NFC')));
    expect(sectionContentHash(`\uFEFF${body}`)).toBe(sectionContentHash(body));
    expect(sectionContentHash(body.replace('có dấu', 'không dấu'))).not.toBe(sectionContentHash(body));
  });

  // The cost must follow the length of the text, not the product of two things an uploader controls.
  // Before the limits below, a 240 KB document of this shape wrote 2.9 GB of heading paths and made every
  // later start of the server run out of memory.
  it('keeps heading paths small when a very long title has many children', () => {
    const text = `# ${'x'.repeat(100_000)}\n${'## a\n'.repeat(5_000)}`;
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections).toHaveLength(5_001);
    const pathBytes = sections.reduce((n, s) => n + JSON.stringify(s.headingPath).length, 0);
    // 5,001 paths of at most two titles of at most MAX_TITLE_CHARS + 1 characters (it was 500 MB)
    expect(pathBytes).toBeLessThan(5_001 * (MAX_TITLE_CHARS + 20));
    expect(sections.every(s => s.headingPath.every(t => t.length <= MAX_TITLE_CHARS + 1))).toBe(true);
  });

  it('keeps the whole title in the key although the path shows only its beginning', () => {
    const long = 'Tiêu đề rất dài '.repeat(40);
    const a = splitIntoSections(`# ${long}A\nx\n`)[0];
    const b = splitIntoSections(`# ${long}B\nx\n`)[0];
    expect(a.headingPath[0]).toBe(b.headingPath[0]);
    expect(a.headingPath[0].length).toBe(MAX_TITLE_CHARS + 1);
    expect(a.stableKey).not.toBe(b.stableKey);
    expect(a.stableKey).toBe(stableKeyForHeadingPath([`${long}A`]));
  });

  it('never cuts a title in the middle of a surrogate pair', () => {
    const title = `${'a'.repeat(MAX_TITLE_CHARS - 1)}😀 tail`;
    const shown = splitIntoSections(`# ${title}\n`)[0].headingPath[0];
    expect(shown).toBe(`${'a'.repeat(MAX_TITLE_CHARS - 1)}…`);
  });

  it('stops starting sections at the limit and leaves the rest of the text in the last one', () => {
    const headingText = `${'# a\nb\n'.repeat(MAX_SECTIONS_PER_VERSION + 5_000)}`;
    const byHeading = splitIntoSections(headingText);
    expectCoverage(headingText, byHeading);
    expect(byHeading).toHaveLength(MAX_SECTIONS_PER_VERSION);
    expect(byHeading[byHeading.length - 1].charEnd).toBe(headingText.length);

    const paragraphText = 'word\n\n'.repeat(MAX_SECTIONS_PER_VERSION + 5_000);
    const byParagraph = splitIntoSections(paragraphText);
    expectCoverage(paragraphText, byParagraph);
    expect(byParagraph).toHaveLength(MAX_SECTIONS_PER_VERSION);

    const withPreamble = `intro\n${headingText}`;
    expect(splitIntoSections(withPreamble)).toHaveLength(MAX_SECTIONS_PER_VERSION);
  });

  // "<pre" or "<!--" that is not the start of an HTML block is ordinary text. An earlier version of the
  // rule opened a block on any of these lines and dropped every heading after it.
  it.each([
    ['inline code mentioning <pre>', 'Wrap output in `<pre>` tags.'],
    ['prose mentioning the element', 'To show code use the <pre element.'],
    ['a placeholder that starts with pre', 'Name it <prefix>-<name>.'],
    ['two placeholders', 'Run: git diff <previous-version> <new-version>'],
    ['inline code mentioning a comment', 'Comments start with `<!--` in HTML.'],
    ['a comment marker in the middle of a line', 'Text before <!-- an unclosed note'],
    ['<pre> indented as code', '    <pre>'],
    ['a complete empty comment', '<!-->'],
    ['a closed comment that mentions <pre>', '<!-- see <pre> below -->'],
    ['a <pre> block closed on its own line', '<pre># not a heading</pre>']
  ])('keeps every later heading after %s', (_label, line) => {
    const text = `# G\n${line}\n## Usage\ntext\n# Config\nmore\n`;
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections.map(s => s.headingPath)).toEqual([['G'], ['G', 'Usage'], ['Config']]);
  });

  it('keeps a heading that mentions <pre> and the headings after it', () => {
    const sections = splitIntoSections('# A\n## Using <pre> blocks\ntext\n## B\ntext\n# C\n');
    expect(sections.map(s => s.headingPath)).toEqual([['A'], ['A', 'Using <pre> blocks'], ['A', 'B'], ['C']]);
  });

  it.each([
    ['a multi-line comment', '<!--\n# hidden\n-->'],
    ['a comment with text on its first line', '<!-- note\n# hidden\nend -->'],
    ['<pre>', '<pre>\n# hidden\n</pre>'],
    ['<PRE> in upper case', '<PRE>\n# hidden\n</PRE>'],
    ['<pre> with an attribute', '<pre class="x">\n# hidden\n</pre>'],
    ['a block indented by three spaces', '   <!--\n# hidden\n   -->']
  ])('does not take a "# " line inside %s as a heading', (_label, block) => {
    const sections = splitIntoSections(`# G\n${block}\n## Usage\ntext\n`);
    expect(sections.map(s => s.headingPath)).toEqual([['G'], ['G', 'Usage']]);
  });

  it('lets a comment that starts a line and is never closed run to the end, as CommonMark does', () => {
    const sections = splitIntoSections('# G\n<!-- never closed\n## Usage\ntext\n');
    expect(sections.map(s => s.headingPath)).toEqual([['G']]);
  });

  it('survives one very long line without headings', () => {
    const text = `${' '.repeat(200_000)}x${'#'.repeat(200_000)}`;
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections).toHaveLength(1);
  });
});

describe('E11-T3: stable_key', () => {
  it('normalises Unicode form, case and whitespace but keeps diacritics apart', () => {
    const nfc = 'Mục tiêu'.normalize('NFC');
    const nfd = 'Mục tiêu'.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(normaliseForKey(`  ${nfd.toUpperCase()}  `)).toBe(nfc.toLowerCase());

    expect(stableKeyForHeadingPath([nfd])).toBe(stableKeyForHeadingPath([nfc]));
    expect(stableKeyForHeadingPath(['MỤC   TIÊU '])).toBe(stableKeyForHeadingPath(['Mục tiêu']));
    expect(stableKeyForHeadingPath(['Mục\ttiêu'])).toBe(stableKeyForHeadingPath(['Mục tiêu']));

    expect(stableKeyForHeadingPath(['Mục tiếu'])).not.toBe(stableKeyForHeadingPath(['Mục tiêu']));
    expect(stableKeyForHeadingPath(['Muc tieu'])).not.toBe(stableKeyForHeadingPath(['Mục tiêu']));
  });

  it('depends on the whole path, and a path is not confused with a title that contains a separator', () => {
    expect(stableKeyForHeadingPath(['A', 'Phạm vi'])).not.toBe(stableKeyForHeadingPath(['B', 'Phạm vi']));
    expect(stableKeyForHeadingPath(['A', 'B'])).not.toBe(stableKeyForHeadingPath(['A","B']));
    expect(stableKeyForHeadingPath(['A', 'B'])).not.toBe(stableKeyForHeadingPath(['A > B']));
  });

  it('maps a Vietnamese heading written in another Unicode form or case to the same section', () => {
    const v2 = VI_V1.replace('## Mục tiêu', `##   ${'MỤC TIÊU'.normalize('NFD')}`);
    expect(v2).not.toBe(VI_V1);
    const a = byPath(splitIntoSections(VI_V1), 'Đặc tả yêu cầu', 'Mục tiêu');
    const b = splitIntoSections(v2).find(s => s.stableKey === a.stableKey);
    expect(b).toBeDefined();
    expect(b!.orderNo).toBe(a.orderNo);
  });

  it('gives duplicate heading paths distinct keys by order of appearance', () => {
    const text = '# Ghi chú\nmột\n# Ghi chú\nhai\n# Khác\n## Ghi chú\nba\n# ghi  chú\nbốn\n';
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);

    const base = stableKeyForHeadingPath(['Ghi chú']);
    expect(sections.map(s => s.stableKey)).toEqual([
      base,
      `${base}-2`,
      stableKeyForHeadingPath(['Khác']),
      stableKeyForHeadingPath(['Khác', 'Ghi chú']),
      `${base}-3`
    ]);
  });

  it('documents the limit of duplicates: removing the first one shifts the keys of the others', () => {
    const v1 = '# Ghi chú\nmột\n# Ghi chú\nhai\n';
    const v2 = '# Ghi chú\nhai\n';
    const mapping = mapSections(splitIntoSections(v1), splitIntoSections(v2));
    // The surviving section ("hai") now carries the key that "một" had: reported as changed, plus one removed
    expect(mapping.changed).toHaveLength(1);
    expect(mapping.onlyInOld).toHaveLength(1);
    expect(mapping.unchanged).toHaveLength(0);
  });
});

describe('E11-T3: documents without headings', () => {
  const P1 = 'Đoạn thứ nhất nói về mục tiêu của hệ thống.';
  const P2 = 'Đoạn thứ hai nói về phạm vi áp dụng.\nDòng tiếp theo của đoạn hai.';
  const P3 = 'Đoạn thứ ba nói về quy tắc nghiệp vụ.';

  it('splits on paragraphs, each section taking the blank lines after it', () => {
    const text = `\n${P1}\n\n\n${P2}\n \n${P3}`;
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections.map(s => textOf(text, s))).toEqual([`\n${P1}\n\n\n`, `${P2}\n \n`, P3]);
    expect(sections.every(s => s.level === 0 && s.headingPath.length === 0)).toBe(true);
    expect(sections.map(s => s.stableKey)).toEqual([P1, P2, P3].map(stableKeyForParagraph));
  });

  it('does not split a fenced code block that contains blank lines', () => {
    const text = `${P1}\n\n\`\`\`\nline one\n\nline two\n\`\`\`\n\n${P3}\n`;
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    expect(sections.map(s => textOf(text, s))).toEqual([`${P1}\n\n`, '```\nline one\n\nline two\n```\n\n', `${P3}\n`]);
  });

  it('gives one section for a single paragraph and for whitespace-only text', () => {
    expect(splitIntoSections(P1)).toHaveLength(1);
    const blank = splitIntoSections(' \n\n');
    expect(blank).toHaveLength(1);
    expectCoverage(' \n\n', blank);
  });

  it('keeps keys when paragraphs are reordered or one is inserted, and drops the key of an edited paragraph', () => {
    const v1 = splitIntoSections([P1, P2, P3].join('\n\n'));
    const reordered = splitIntoSections([P3, 'Đoạn mới chèn vào.', P1, P2].join('\n\n'));
    const m1 = mapSections(v1, reordered);
    // P2 was last in v1 and is last again, P1 and P3 moved: all three keep key and content
    expect(m1.unchanged).toHaveLength(3);
    expect(m1.changed).toHaveLength(0);
    expect(m1.onlyInOld).toHaveLength(0);
    expect(m1.onlyInNew).toHaveLength(1);

    // Limit: the key is derived from the paragraph text, so an edited paragraph is "removed + added", never "changed"
    const edited = splitIntoSections([P1, P2.replace('phạm vi', 'giới hạn'), P3].join('\n\n'));
    const m2 = mapSections(v1, edited);
    expect(m2.unchanged).toHaveLength(2);
    expect(m2.changed).toHaveLength(0);
    expect(m2.onlyInOld).toHaveLength(1);
    expect(m2.onlyInNew).toHaveLength(1);
  });

  it('gives identical paragraphs distinct keys', () => {
    const text = `${P1}\n\n${P1}\n\n${P1}`;
    const sections = splitIntoSections(text);
    expectCoverage(text, sections);
    const base = stableKeyForParagraph(P1);
    expect(sections.map(s => s.stableKey)).toEqual([base, `${base}-2`, `${base}-3`]);
  });
});

describe('E11-T3: mapSections between two versions', () => {
  const section = (title: string, body: string) => `## ${title}\n${body}\n\n`;
  const A = section('Mục tiêu', 'Hoàn tiền trong 3 ngày.');
  const B = section('Phạm vi', 'Khách hàng doanh nghiệp.');
  const C = section('Quy tắc nghiệp vụ', 'Bắt buộc có mã đối soát.');
  const HEAD = '# Đặc tả\n\n';
  const v1Text = HEAD + A + B + C;
  const v1 = splitIntoSections(v1Text);
  const keyOf = (title: string) => stableKeyForHeadingPath(['Đặc tả', title]);

  it('maps reordered sections: same keys, same hashes, different order', () => {
    const v2 = splitIntoSections(HEAD + C + A + B);
    const mapping = mapSections(v1, v2);

    expect(mapping.unchanged.map(p => p.stableKey).sort()).toEqual(v1.map(s => s.stableKey).sort());
    expect(mapping.changed).toEqual([]);
    expect(mapping.onlyInOld).toEqual([]);
    expect(mapping.onlyInNew).toEqual([]);

    const moved = mapping.unchanged.find(p => p.stableKey === keyOf('Quy tắc nghiệp vụ'))!;
    expect(moved.old.orderNo).toBe(3);
    expect(moved.new.orderNo).toBe(1);
    expect(moved.old.charStart).not.toBe(moved.new.charStart);
    expect(v2.map(s => s.stableKey)).not.toEqual(v1.map(s => s.stableKey));
  });

  it('reports a section whose text changed: same key, different hash', () => {
    const v2 = splitIntoSections(HEAD + A + B.replace('doanh nghiệp', 'cá nhân') + C);
    const mapping = mapSections(v1, v2);
    expect(mapping.changed.map(p => p.stableKey)).toEqual([keyOf('Phạm vi')]);
    expect(mapping.changed[0].old.contentHash).not.toBe(mapping.changed[0].new.contentHash);
    expect(mapping.unchanged).toHaveLength(3);
    expect(mapping.onlyInOld).toEqual([]);
    expect(mapping.onlyInNew).toEqual([]);
  });

  it('reports a section added and a section removed', () => {
    const D = section('Bảo mật', 'Mã hóa dữ liệu khi lưu.');
    const v2 = splitIntoSections(HEAD + A + C + D);
    const mapping = mapSections(v1, v2);
    expect(mapping.onlyInOld.map(s => s.stableKey)).toEqual([keyOf('Phạm vi')]);
    expect(mapping.onlyInNew.map(s => s.stableKey)).toEqual([keyOf('Bảo mật')]);
    expect(mapping.unchanged).toHaveLength(3);
    expect(mapping.changed).toEqual([]);
  });

  it('documents the limit of a rename: the old key disappears and a new key appears', () => {
    const v2 = splitIntoSections(HEAD + A + B.replace('## Phạm vi', '## Phạm vi áp dụng') + C);
    const mapping = mapSections(v1, v2);
    expect(mapping.onlyInOld.map(s => s.stableKey)).toEqual([keyOf('Phạm vi')]);
    expect(mapping.onlyInNew.map(s => s.stableKey)).toEqual([keyOf('Phạm vi áp dụng')]);
    expect(mapping.changed).toEqual([]);
    expect(mapping.unchanged).toHaveLength(3);
  });

  it('documents the limit of renaming a parent: every child gets a new key', () => {
    const v2 = splitIntoSections(v1Text.replace('# Đặc tả', '# Đặc tả v2'));
    const mapping = mapSections(v1, v2);
    expect(mapping.unchanged).toEqual([]);
    expect(mapping.onlyInOld).toHaveLength(4);
    expect(mapping.onlyInNew).toHaveLength(4);
  });
});

describe('E11-T3: findSectionForAnchor', () => {
  const text = '# A\nAlpha rule must hold.\n# B\nBeta rule must hold.\nShared sentence.\n# C\nShared sentence.\n';
  const sections = splitIntoSections(text);
  const at = (needle: string, from = 0) => text.indexOf(needle, from);

  it('uses offsets that match the quote', () => {
    const quote = 'Beta rule must hold.';
    const found = findSectionForAnchor(text, sections, { charStart: at(quote), charEnd: at(quote) + quote.length, exactQuote: quote });
    expect(found?.headingPath).toEqual(['B']);
  });

  it('uses the offsets to tell apart a quote that occurs in two sections', () => {
    const quote = 'Shared sentence.';
    const second = at(quote, at(quote) + 1);
    expect(findSectionForAnchor(text, sections, { charStart: at(quote), charEnd: at(quote) + quote.length, exactQuote: quote })?.headingPath).toEqual(['B']);
    expect(findSectionForAnchor(text, sections, { charStart: second, charEnd: second + quote.length, exactQuote: quote })?.headingPath).toEqual(['C']);
  });

  it('falls back to the quote when the offsets are missing or wrong', () => {
    const quote = 'Beta rule must hold.';
    for (const anchor of [
      { charStart: 0, charEnd: 0, exactQuote: quote },
      { charStart: 2, charEnd: 2 + quote.length, exactQuote: quote },
      { charStart: null, charEnd: undefined, exactQuote: quote },
      { charStart: 5000, charEnd: 6000, exactQuote: quote },
      { charStart: -4, charEnd: 3, exactQuote: quote }
    ]) {
      expect(findSectionForAnchor(text, sections, anchor)?.headingPath).toEqual(['B']);
    }
  });

  it('returns null instead of guessing', () => {
    // Quote in two different sections and no usable offsets
    expect(findSectionForAnchor(text, sections, { charStart: 0, charEnd: 0, exactQuote: 'Shared sentence.' })).toBeNull();
    // Quote not in the text
    expect(findSectionForAnchor(text, sections, { charStart: 4, charEnd: 9, exactQuote: 'Not in the document' })).toBeNull();
    // Nothing to go on
    expect(findSectionForAnchor(text, sections, { charStart: 0, charEnd: 0, exactQuote: '' })).toBeNull();
    // No sections
    expect(findSectionForAnchor('', [], { charStart: 0, charEnd: 3, exactQuote: 'abc' })).toBeNull();
  });

  it('accepts a quote that occurs several times inside one section', () => {
    const repeated = '# A\nsame. same. same.\n# B\nother';
    const found = findSectionForAnchor(repeated, splitIntoSections(repeated), { exactQuote: 'same.' });
    expect(found?.headingPath).toEqual(['A']);
  });

  it('searches a long repetitive quote in linear time', () => {
    // 200k characters used to take about 4 s here, and again on every start because the result is null
    const n = 400_000;
    const big = `${'a'.repeat(n)}\n\n# H\n${'a'.repeat(n / 2)}`;
    const bigSections = splitIntoSections(big);
    const started = performance.now();
    const found = findSectionForAnchor(big, bigSections, { charStart: 0, charEnd: 0, exactQuote: 'a'.repeat(n / 2) });
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(found).toBeNull(); // the quote occurs in two sections
  });

  it('resolves nothing when no quote is given, because offsets alone cannot be checked', () => {
    expect(findSectionForAnchor(text, sections, { charStart: at('Alpha'), charEnd: at('Alpha') + 5 })).toBeNull();
    expect(findSectionForAnchor(text, sections, { charStart: at('Alpha'), charEnd: at('Alpha') + 5, exactQuote: '' })).toBeNull();
  });
});
