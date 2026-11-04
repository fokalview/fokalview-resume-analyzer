import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the actual browser DOMParser without exposing source modules through
// the production server or replacing XML parsing with a test-only approximation.
const source = readFileSync(new URL('../../src/lib/resumeDocument.ts', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const docx = (body: string) => `<w:document xmlns:w="${word}"><w:body>${body}</w:body></w:document>`;
const odt = (body: string) => `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:text>${body}</office:text></office:body></office:document-content>`;

test('DOCX preserves paragraph runs, explicit font properties and table-cell references', async ({ page }) => {
  const xml = docx('<w:p><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="22"/><w:b/></w:rPr><w:t xml:space="preserve">Zoë </w:t></w:r><w:r><w:t>李</w:t><w:tab/><w:t>Engineer</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>School</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2026</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
  const result = await page.evaluate(async ({ url, xml }) => {
    const { documentFromOfficeXml } = await import(url);
    return documentFromOfficeXml([{ path: 'word/document.xml', xml }], 'docx');
  }, { url: moduleUrl, xml });
  expect(result.text).toBe('Zoë 李\tEngineer\nSchool\n2026');
  expect(result.pages).toEqual([]);
  expect(result.blocks.every((block: any) => block.page === null && block.geometry === null)).toBe(true);
  expect(result.blocks[0].runs.map((run: any) => run.text)).toEqual(['Zoë ', '李\tEngineer']);
  expect(result.blocks[0].runs[0]).toMatchObject({ fontName: 'Arial', fontSize: 11, bold: true });
  expect(result.blocks[1].sourcePath).toContain('/w:tbl[1]/w:tr[1]/w:tc[1]/w:p[1]');
  expect(result.blocks[2].sourcePath).toContain('/w:tc[2]/');
  expect(result.source.warnings.join(' ')).toContain('page positions');
});

test('DOCX keeps visible revision text and header/footer parts without claiming rendered positions', async ({ page }) => {
  const result = await page.evaluate(async ({ url, word, body }) => {
    const { documentFromOfficeXml } = await import(url);
    const parts = [
      { path: 'word/header1.xml', xml: `<w:hdr xmlns:w="${word}"><w:p><w:r><w:t>Contact</w:t></w:r></w:p></w:hdr>` },
      { path: 'word/document.xml', xml: body },
      { path: 'word/footer1.xml', xml: `<w:ftr xmlns:w="${word}"><w:p><w:r><w:t>Portfolio</w:t></w:r></w:p></w:ftr>` }
    ];
    const result = documentFromOfficeXml(parts, 'docx');
    return { result, idsAgain: documentFromOfficeXml(parts, 'docx').blocks.map((block: any) => block.id) };
  }, { url: moduleUrl, word, body: docx('<w:p><w:del><w:r><w:delText>Old employer</w:delText></w:r></w:del><w:ins><w:r><w:t>Current employer</w:t></w:r></w:ins></w:p>') });
  expect(result.result.text).toBe('Contact\nCurrent employer\nPortfolio');
  expect(result.result.blocks.map((block: any) => block.id)).toEqual(result.idsAgain);
  expect(result.result.source.warnings.join(' ')).toContain('Tracked deletions are excluded');
  expect(result.result.source.warnings.join(' ')).toContain('rendered placement is unknown');
});

test('ODT preserves headings, spans, spaces, line breaks and table paths in document order', async ({ page }) => {
  const xml = odt('<text:h text:outline-level="1">Profile</text:h><text:p>Zoë<text:s text:c="2"/><text:span>李</text:span><text:tab/>Engineer<text:line-break/>Analyst</text:p><table:table><table:table-row><table:table-cell><text:p>School</text:p></table:table-cell></table:table-row></table:table>');
  const result = await page.evaluate(async ({ url, xml }) => {
    const { documentFromOfficeXml } = await import(url);
    return documentFromOfficeXml([{ path: 'content.xml', xml }], 'odt');
  }, { url: moduleUrl, xml });
  expect(result.text).toBe('Profile\nZoë  李\tEngineer\nAnalyst\nSchool');
  expect(result.blocks[0].sourcePath).toContain('/text:h[1]');
  expect(result.blocks[2].sourcePath).toContain('/table:table-cell[1]/text:p[1]');
  expect(result.pages).toEqual([]);
  expect(result.blocks.every((block: any) => block.geometry === null)).toBe(true);
});

test('XML parsing rejects malformed documents, entity declarations, expansion and too many runs', async ({ page }) => {
  const failures = await page.evaluate(async ({ url, cases }) => {
    const { documentFromOfficeXml } = await import(url);
    return cases.map(({ format, xml }: { format: string; xml: string }) => {
      try { documentFromOfficeXml([{ path: 'fixture.xml', xml }], format); return 'accepted'; }
      catch (error) { return error instanceof Error ? error.message : String(error); }
    });
  }, { url: moduleUrl, cases: [
    { format: 'docx', xml: '<doc><broken></doc>' },
    { format: 'docx', xml: '<!DOCTYPE doc [<!ENTITY item "unexpected">]><doc>&item;</doc>' },
    { format: 'odt', xml: odt('<text:p><text:s text:c="50000"/><text:s text:c="50000"/></text:p>') },
    { format: 'docx', xml: docx('<w:p><w:r><w:t>x</w:t></w:r></w:p>'.repeat(2501)) }
  ] });
  expect(failures[0]).toContain('malformed XML');
  expect(failures[1]).toContain('unsupported');
  expect(failures[2]).toContain('oversized repeated-space');
  expect(failures[3]).toContain('too many text runs');
});
