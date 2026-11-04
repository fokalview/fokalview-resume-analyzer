import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock, test } from "node:test";
import JSZip from "jszip";
import {
  RESUME_LIMITS, documentFromText, documentFromPdfPages, documentFromOfficeXml,
  extractResumeDocument, pdfTextGeometry, rtfText
} from "../src/lib/resumeDocument.ts";

const viewport = { width: 612, height: 792, transform: [1, 0, 0, -1, 0, 792], scale: 1 };
const run = (str, overrides = {}) => ({ str, transform: [12, 0, 0, 12, 72, 720], width: 120, height: 12, fontName: "F1", dir: "ltr", hasEOL: false, ...overrides });
const page = (items, overrides = {}) => ({ page: 1, rotation: 0, viewport, items, styles: { F1: { ascent: 0.8, descent: -0.2 } }, ...overrides });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);

test("pasted text retains Unicode, exact whitespace and line references without inventing positions", () => {
  const text = "  Zoë 李\r\nEngineer\n\nSkills\tTypeScript  ";
  const document = documentFromText(text);
  assert.equal(document.schemaVersion, "sagittaiq-resume-v1");
  assert.equal(document.text, text);
  assert.deepEqual(document.blocks.map(block => block.text), ["  Zoë 李", "Engineer", "", "Skills\tTypeScript  "]);
  assert.deepEqual(document.pages, []);
  assert.ok(document.blocks.every(block => block.page === null && block.geometry === null));
  assert.equal(document.blocks[2].sourcePath, "text/line[3]");
  assert.deepEqual(document.blocks.map(block => block.id), documentFromText(text).blocks.map(block => block.id));
  assert.equal(document.source.status, "ready");
  assert.equal(documentFromText(" \n").source.status, "needs_text");
});

test("limits reject oversized text and excessive blocks without silently truncating", () => {
  assert.equal(documentFromText("a".repeat(RESUME_LIMITS.maxTextCharacters)).text.length, 50000);
  assert.throws(() => documentFromText("a".repeat(50001)), /not been shortened/);
  assert.throws(() => documentFromText("a\0b"), /binary characters/);
  assert.throws(() => documentFromText("\n".repeat(5000)), /too many text blocks/);
});

test("PDF geometry accounts for top-left viewport coordinates and font ascent", () => {
  const geometry = pdfTextGeometry(run("Analyst"), { ascent: 0.8 }, viewport);
  close(geometry.x, 72 / 612);
  close(geometry.y, 62.4 / 792);
  close(geometry.width, 120 / 612);
  close(geometry.height, 12 / 792);
});

test("PDF geometry rotates the text envelope with the displayed page", () => {
  const rotated = { width: 792, height: 612, transform: [0, 1, 1, 0, 0, 0], scale: 1 };
  const geometry = pdfTextGeometry(run("Analyst"), { ascent: 0.8 }, rotated);
  close(geometry.x, 717.6 / 792);
  close(geometry.y, 72 / 612);
  close(geometry.width, 12 / 792);
  close(geometry.height, 120 / 612);
});

test("PDF geometry honors crop offsets/scaling, clips to the page, and rejects unusable transforms", () => {
  // UserUnit can scale the matrix while the PDF.js viewport.scale remains 1.
  const cropped = { width: 1000, height: 1400, transform: [2, 0, 0, -2, -100, 1450], scale: 1 };
  const geometry = pdfTextGeometry(run("Analyst"), { descent: -0.2 }, cropped);
  close(geometry.x, 44 / 1000);
  assert.equal(geometry.y, 0);
  close(geometry.width, 240 / 1000);
  close(geometry.height, 14.8 / 1400);
  assert.equal(pdfTextGeometry(run("bad", { transform: [NaN, 0, 0, 12, 72, 720] }), {}, viewport), null);
  assert.equal(pdfTextGeometry(run("outside", { transform: [12, 0, 0, 12, -300, 720] }), {}, viewport), null);
  assert.equal(pdfTextGeometry(run("empty", { width: 0 }), {}, viewport), null);
});

test("PDF packages preserve individual source runs, exact raw transforms and declared stream order", () => {
  const inputs = [page([run("Skills", { hasEOL: true }), run("right column"), run("left column", { transform: [12, 0, 0, 12, 10, 600] })])];
  const document = documentFromPdfPages(inputs);
  assert.equal(document.text, "Skills\nright column left column");
  assert.deepEqual(document.blocks.map(block => block.text), ["Skills", "right column", "left column"]);
  assert.deepEqual(document.blocks.map(block => block.readingOrder), [1, 2, 3]);
  assert.deepEqual(document.blocks[0].rawTransform, [12, 0, 0, 12, 72, 720]);
  assert.equal(document.blocks[0].fontSize, 12);
  assert.equal(document.blocks[0].hasEOL, true);
  assert.equal(document.blocks[2].id, "p0001-r0003");
  assert.equal(document.pages[0].coordinateSystem, "normalized-top-left");
  assert.match(document.source.warnings.join(" "), /stream.*columns/i);
  assert.equal(document.source.status, "ready");
});

test("scanned or partially unreadable PDFs require text and explicitly disclose missing OCR", () => {
  const scanned = documentFromPdfPages([page([])]);
  assert.equal(scanned.text, "");
  assert.equal(scanned.source.status, "needs_text");
  assert.match(scanned.source.warnings.join(" "), /OCR was not performed/);
  const partial = documentFromPdfPages([page([run("Readable")]), page([], { page: 2 })]);
  assert.equal(partial.source.status, "needs_text");
  assert.equal(partial.pages.length, 2);
  const badPosition = documentFromPdfPages([page([run("kept", { transform: [NaN, 0, 0, 0, 0, 0] })])]);
  assert.equal(badPosition.blocks[0].text, "kept");
  assert.equal(badPosition.blocks[0].geometry, null);
  assert.equal(badPosition.blocks[0].rawTransform, undefined);
  assert.match(badPosition.source.warnings.join(" "), /no usable on-page position/);
});

test("PDF package size, page count and run counts are bounded", () => {
  assert.throws(() => documentFromPdfPages(Array.from({ length: 101 }, (_, i) => page([], { page: i + 1 }))), /100 pages/);
  assert.throws(() => documentFromPdfPages([page(Array.from({ length: 5001 }, () => run("a")))]), /too many text runs/);
  assert.throws(() => documentFromPdfPages([page([run("x", { fontName: "F".repeat(1024 * 1024) })])]), /exceeds 1 MiB/);
  assert.throws(() => documentFromPdfPages([page([], { viewport: { ...viewport, width: 0 } })]), /invalid page dimensions/);
});

test("file extraction records independently reproducible SHA-256 and original metadata", async () => {
  const text = "Zoë 李\nEngineering\n  Skills,analysis";
  for (const extension of ["txt", "md", "csv"]) {
    const file = new File([text], `resume.${extension}`);
    const document = await extractResumeDocument(file);
    assert.equal(document.text, text);
    assert.equal(document.source.format, extension);
    assert.equal(document.source.fileName, file.name);
    assert.equal(document.source.size, file.size);
    assert.equal(document.source.sha256, createHash("sha256").update(text).digest("hex"));
    assert.ok(Date.parse(document.source.extractedAt));
  }
  assert.equal((await extractResumeDocument(new File(["Name"], "resume", { type: "text/plain" }))).source.format, "txt");
});

test("invalid and oversized uploads are rejected before parsing, unsupported encoding requests text", async () => {
  await assert.rejects(extractResumeDocument(new File([], "empty.txt")), /empty/);
  await assert.rejects(extractResumeDocument(new File([new Uint8Array(RESUME_LIMITS.maxFileBytes + 1)], "large.txt")), /10 MiB/);
  await assert.rejects(extractResumeDocument(new File(["body"], "resume.doc")), /Export legacy DOC/);
  await assert.rejects(extractResumeDocument(new File(["not pdf"], "resume.pdf")), /valid PDF header/);
  await assert.rejects(extractResumeDocument(new File(["not zip"], "resume.docx")), /valid document package/);
  await assert.rejects(extractResumeDocument(new File(["not rtf"], "resume.rtf")), /valid RTF header/);
  const document = await extractResumeDocument(new File([Uint8Array.of(255, 254, 65)], "resume.txt"));
  assert.equal(document.source.status, "needs_text");
  assert.equal(document.text, "");
  assert.match(document.source.warnings.join(" "), /encoding could not be read/);
});

test("RTF retains Unicode, accents, text groups and paragraph/tab boundaries", async () => {
  const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Hidden Font;}}Zo\'eb \u26446?\par {\b Engineer}\tab Skills\line \{code\} \\test{\*\generator Hidden;}}`;
  assert.equal(rtfText(rtf), "Zoë 李\nEngineer\tSkills\n{code} \\test");
  assert.equal(rtfText(String.raw`{\rtf1\uc0\u233\u-10179\u-8704}`), "é😀");
  assert.equal(rtfText(String.raw`{\rtf1A\emdash B\endash C\bullet D\~E\_F\-G}`), "A—B–C•D E‑F­G");
  const document = await extractResumeDocument(new File([rtf], "resume.rtf"));
  assert.equal(document.source.extractor, "rtf-logical-text");
  assert.equal(document.pages.length, 0);
  assert.ok(document.blocks.every(block => block.geometry === null));
  assert.throws(() => rtfText(`{\\rtf1 ${"a".repeat(50001)}}`), /50,000/);
  assert.throws(() => rtfText("{".repeat(257)), /nested groups/);
});

test("Office packages enforce expanded XML limits before browser parsing", async () => {
  const zip = new JSZip();
  zip.file("word/document.xml", "a".repeat(2 * 1024 * 1024 + 1));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  assert.ok(bytes.length < 10000);
  await assert.rejects(extractResumeDocument(new File([bytes], "expanded.docx")), /expanded document text is too large/);
  const missing = await new JSZip().file("other.xml", "content").generateAsync({ type: "uint8array" });
  await assert.rejects(extractResumeDocument(new File([missing], "missing.odt")), /readable document content/);
  assert.throws(() => documentFromOfficeXml([{ path: "word/document.xml", xml: '<!DOCTYPE doc [<!ENTITY leak SYSTEM "file:///test">]><doc />' }], "docx"), /unsupported/);
});

test("PDF adapter disables text normalization, respects rotated viewports, and destroys its worker", async () => {
  let destroyed = 0, cleaned = 0;
  let count = 1;
  const worker = { workerSrc: "" };
  const mocked = mock.module("pdfjs-dist", { namedExports: {
    GlobalWorkerOptions: worker, version: "test-pdfjs",
    getDocument: () => ({
      promise: Promise.resolve({ numPages: count, getPage: async () => ({
        rotate: 90,
        getViewport: options => { assert.equal(options.scale, 1); return { width: 792, height: 612, transform: [0, 1, 1, 0, 0, 0], scale: 1 }; },
        getTextContent: async options => { assert.equal(options.disableNormalization, true); return { items: [run("ﬃ"), { type: "beginMarkedContent" }], styles: { F1: { ascent: 0.8 } } }; },
        cleanup: () => { cleaned++; }
      }) }),
      destroy: async () => { destroyed++; }
    })
  } });
  try {
    const document = await extractResumeDocument(new File(["%PDF-test"], "rotation.pdf"));
    assert.equal(document.text, "ﬃ");
    assert.equal(document.source.extractorVersion, "test-pdfjs");
    assert.equal(document.pages[0].rotation, 90);
    assert.equal(document.blocks.length, 1);
    assert.equal(cleaned, 1);
    assert.equal(destroyed, 1);
    assert.match(worker.workerSrc, /pdf\.worker\.mjs/);
    count = 101;
    await assert.rejects(extractResumeDocument(new File(["%PDF-test"], "too-many.pdf")), /100 pages/);
    assert.equal(destroyed, 2);
  } finally { mocked.restore(); }
});
