export const RESUME_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxPages: 100,
  maxTextCharacters: 50000,
  maxBlocks: 5000,
  maxDocumentBytes: 1024 * 1024
});

export type ResumeGeometry = { x: number; y: number; width: number; height: number };
export type ResumeRun = { id: string; text: string; sourcePath: string; fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean };
export type ResumeBlock = {
  id: string; page: number | null; text: string; readingOrder: number;
  geometry: ResumeGeometry | null; rawTransform?: number[]; fontName?: string;
  fontSize?: number; direction?: string; hasEOL?: boolean; sourcePath?: string; runs?: ResumeRun[];
};
export type ResumeDocument = {
  schemaVersion: "sagittaiq-resume-v1";
  text: string;
  source: {
    format: string; fileName: string; mimeType: string; size: number; sha256: string;
    extractor: string; extractorVersion: string; extractedAt: string;
    status: "ready" | "needs_text"; warnings: string[];
  };
  pages: Array<{ page: number; width: number; height: number; rotation: number; coordinateSystem: "normalized-top-left" }>;
  blocks: ResumeBlock[];
};

type PdfRun = { str: string; transform: number[]; width: number; height: number; fontName: string; dir?: string; hasEOL?: boolean };
type PdfStyle = { ascent?: number; descent?: number; vertical?: boolean };
type PdfViewport = { width: number; height: number; transform: number[]; scale?: number };
type PdfPageInput = { page: number; rotation: number; viewport: PdfViewport; items: PdfRun[]; styles: Record<string, PdfStyle> };
const encoder = new TextEncoder();
const EXTRACTOR_VERSION = "1";
const MAX_XML_BYTES = 2 * 1024 * 1024;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";

/** Pasted/edited text has logical lines, never fabricated page coordinates. */
export function documentFromText(text: string): ResumeDocument {
  validateText(text);
  const document: ResumeDocument = {
    schemaVersion: "sagittaiq-resume-v1", text,
    source: { format: "pasted", fileName: "", mimeType: "text/plain", size: encoder.encode(text).length,
      sha256: "", extractor: "logical-text", extractorVersion: EXTRACTOR_VERSION,
      extractedAt: new Date().toISOString(), status: text.trim() ? "ready" : "needs_text",
      warnings: ["Logical text lines are preserved. Page positions and visual formatting are unavailable."] },
    pages: [],
    blocks: text ? text.split(/\r\n|\r|\n/).map((line, index, lines) => ({
      id: `line${String(index + 1).padStart(4, "0")}`, page: null, text: line,
      readingOrder: index + 1, geometry: null, hasEOL: index < lines.length - 1,
      sourcePath: `text/line[${index + 1}]`
    })) : []
  };
  return validateDocument(document);
}

/** Original bytes are stored independently by the caller before this parser runs. */
export async function extractResumeDocument(file: File): Promise<ResumeDocument> {
  if (file.size > RESUME_LIMITS.maxFileBytes) throw new Error("Choose a resume file of 10 MiB or smaller.");
  if (!file.size) throw new Error("This file is empty. Choose a file containing your resume.");
  const format = fileFormat(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  let document: ResumeDocument;
  if (format === "pdf") {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("The file does not contain a valid PDF header.");
    document = await extractPdfDocument(bytes);
  } else if (format === "docx" || format === "odt") {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("The file does not contain a valid document package.");
    document = await extractOfficeDocument(bytes, format);
  } else {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch {
      document = documentFromText("");
      document.source.warnings = ["This file's text encoding could not be read. The original file is retained; paste readable text for analysis."];
      return finishFile(document, file, format, sha256);
    }
    if (format === "rtf") {
      if (!/^\s*\{\\rtf\d/.test(text)) throw new Error("The file does not contain a valid RTF header.");
      document = documentFromText(rtfText(text));
      document.source.extractor = "rtf-logical-text";
      document.source.warnings.push("RTF text is extracted as logical paragraphs; unsupported layout controls are not interpreted.");
    } else document = documentFromText(text);
  }
  return finishFile(document, file, format, sha256);
}

function finishFile(document: ResumeDocument, file: File, format: string, sha256: string) {
  document.source = { ...document.source, format, fileName: file.name, mimeType: file.type || mimeFor(format), size: file.size, sha256 };
  return validateDocument(document);
}

function fileFormat(file: File) {
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension && ["pdf", "docx", "odt", "rtf", "txt", "md", "csv"].includes(extension)) return extension;
  const byMime: Record<string, string> = { "application/pdf": "pdf", "application/rtf": "rtf", "text/rtf": "rtf", "text/plain": "txt", "text/markdown": "md", "text/csv": "csv" };
  if (!extension && byMime[file.type]) return byMime[file.type];
  throw new Error("Choose a PDF, DOCX, ODT, RTF, TXT, MD, or CSV resume. Export legacy DOC or Pages files first.");
}
function mimeFor(format: string) {
  return ({ pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", odt: "application/vnd.oasis.opendocument.text", rtf: "application/rtf", txt: "text/plain", md: "text/markdown", csv: "text/csv" } as Record<string, string>)[format] || "application/octet-stream";
}

async function extractPdfDocument(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const loading = pdfjs.getDocument({ data: bytes });
  let pdf;
  try {
    pdf = await loading.promise;
    if (pdf.numPages > RESUME_LIMITS.maxPages) throw new Error("Choose a resume with no more than 100 pages.");
    const pages: PdfPageInput[] = [];
    let runCount = 0;
    let textLength = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ disableNormalization: true });
      const items = content.items.filter(item => "str" in item);
      runCount += items.length;
      textLength += items.reduce((total, item) => total + item.str.length + 1, 2);
      if (runCount > RESUME_LIMITS.maxBlocks || textLength > RESUME_LIMITS.maxTextCharacters) throw new Error("This resume contains too much text or too many text runs. Choose a shorter version.");
      pages.push({ page: pageNumber, rotation: page.rotate, viewport, items, styles: content.styles });
      page.cleanup();
    }
    const document = documentFromPdfPages(pages);
    document.source.extractorVersion = pdfjs.version;
    return document;
  } finally { await loading.destroy(); }
}

/** Pure conversion keeps source runs intact; order is explicit, not guessed from columns. */
export function documentFromPdfPages(inputs: PdfPageInput[]): ResumeDocument {
  const document = documentFromText("");
  document.source.format = "pdf";
  document.source.extractor = "pdfjs-text-runs";
  document.source.warnings = [
    "Reading order follows the PDF text stream; joined spacing is inferred. Columns, tables or positioned text may need review. Original extracted runs are retained.",
    "Coordinates are normalized top-left text-run envelopes clipped to the page, not exact glyph outlines. Raw transforms are retained."
  ];
  if (inputs.length > RESUME_LIMITS.maxPages) throw new Error("Choose a resume with no more than 100 pages.");
  const pageTexts: string[] = [];
  let missingPages = 0;
  for (const input of inputs) {
    if (![input.viewport.width, input.viewport.height].every(value => Number.isFinite(value) && value > 0)) throw new Error("This PDF has invalid page dimensions.");
    document.pages.push({ page: input.page, width: input.viewport.width, height: input.viewport.height, rotation: input.rotation, coordinateSystem: "normalized-top-left" });
    const parts: string[] = [];
    for (let index = 0; index < input.items.length; index++) {
      const item = input.items[index];
      if (document.blocks.length >= RESUME_LIMITS.maxBlocks) throw new Error("This resume contains too many text runs.");
      const validTransform = item.transform.length === 6 && item.transform.every(Number.isFinite);
      document.blocks.push({
        id: `p${String(input.page).padStart(4, "0")}-r${String(index + 1).padStart(4, "0")}`,
        page: input.page, text: item.str, readingOrder: document.blocks.length + 1,
        geometry: pdfTextGeometry(item, input.styles[item.fontName] || {}, input.viewport),
        ...(validTransform ? { rawTransform: [...item.transform] } : {}),
        fontName: item.fontName, fontSize: validTransform ? Math.hypot(item.transform[2], item.transform[3]) : 0,
        direction: item.dir || "ltr", hasEOL: Boolean(item.hasEOL), sourcePath: `page[${input.page}]/text[${index + 1}]`
      });
      parts.push(item.str);
      if (item.hasEOL) parts.push("\n");
      else if (index < input.items.length - 1 && item.str && !/\s$/.test(item.str) && !/^\s/.test(input.items[index + 1].str)) parts.push(" ");
    }
    const text = parts.join("");
    pageTexts.push(text);
    if (!text.trim()) missingPages++;
  }
  document.text = pageTexts.join("\n\n");
  document.source.status = document.text.trim() && !missingPages ? "ready" : "needs_text";
  if (missingPages) document.source.warnings.push(`${missingPages} page(s) have no extractable text. They may be blank or scanned; OCR was not performed.`);
  if (document.blocks.some(block => block.text.trim() && !block.geometry)) document.source.warnings.push("Some text runs have no usable on-page position; their source text remains available.");
  return validateDocument(document);
}

/** Mirrors PDF.js text-layer orientation/ascent, with viewport rotation applied. */
export function pdfTextGeometry(item: PdfRun, style: PdfStyle, viewport: PdfViewport): ResumeGeometry | null {
  if (item.transform.length !== 6 || viewport.transform.length !== 6 || ![...item.transform, ...viewport.transform, item.width, item.height, viewport.width, viewport.height].every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return null;
  const [a, b, c, d, e, f] = viewport.transform;
  const [u, v, w, z, x, y] = item.transform;
  const tx = [a * u + c * v, b * u + d * v, a * w + c * z, b * w + d * z, a * x + c * y + e, b * x + d * y + f];
  if (!tx.every(Number.isFinite)) return null;
  const angle = Math.atan2(tx[1], tx[0]) + (style.vertical ? Math.PI / 2 : 0);
  const height = Math.hypot(tx[2], tx[3]);
  // The viewport matrix includes PDF UserUnit; viewport.scale alone does not.
  const scale = Math.hypot(a, b);
  const width = Math.abs(style.vertical ? item.height : item.width) * scale;
  const ascentRatio = Number.isFinite(style.ascent) ? style.ascent! : Number.isFinite(style.descent) ? 1 + style.descent! : 0.8;
  const ascent = height * ascentRatio;
  if (!(width > 0 && height > 0) || ![width, height, ascent].every(Number.isFinite)) return null;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const left = tx[4] + ascent * sin, top = tx[5] - ascent * cos;
  const points = [[left, top], [left + cos * width, top + sin * width], [left - sin * height, top + cos * height], [left + cos * width - sin * height, top + sin * width + cos * height]];
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const x1 = clamp(Math.min(...points.map(point => point[0])) / viewport.width);
  const y1 = clamp(Math.min(...points.map(point => point[1])) / viewport.height);
  const x2 = clamp(Math.max(...points.map(point => point[0])) / viewport.width);
  const y2 = clamp(Math.max(...points.map(point => point[1])) / viewport.height);
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
}

async function extractOfficeDocument(bytes: Uint8Array, format: "docx" | "odt") {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  if (Object.keys(zip.files).length > 2500) throw new Error("This document package has too many entries.");
  const mainPath = format === "docx" ? "word/document.xml" : "content.xml";
  if (!zip.file(mainPath)) throw new Error("The file does not contain readable document content.");
  const paths = format === "docx"
    ? [...Object.keys(zip.files).filter(path => /^word\/header\d+\.xml$/.test(path)).sort(), mainPath, ...Object.keys(zip.files).filter(path => /^word\/(footer\d+|footnotes|endnotes)\.xml$/.test(path)).sort()]
    : [mainPath];
  const parts: Array<{ path: string; xml: string }> = [];
  let totalXml = 0;
  for (const path of paths) {
    const xml = await boundedZipText(zip.file(path)!);
    totalXml += encoder.encode(xml).length;
    if (totalXml > MAX_XML_BYTES) throw new Error("The expanded document text is too large to parse safely.");
    parts.push({ path, xml });
  }
  return documentFromOfficeXml(parts, format);
}

type ZipTextEntry = { internalStream: (type: string) => { on: (event: string, callback: (value?: unknown) => void) => unknown; resume: () => void; pause: () => void } };
async function boundedZipText(entry: unknown): Promise<string> {
  // JSZip documents internalStream; its older TypeScript declarations omit it.
  const stream = (entry as ZipTextEntry).internalStream("uint8array");
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []; let size = 0; let stopped = false;
    stream.on("data", value => {
      if (stopped) return;
      const chunk = value as Uint8Array; size += chunk.length;
      if (size > MAX_XML_BYTES) { stopped = true; stream.pause(); reject(new Error("The expanded document text is too large to parse safely.")); return; }
      chunks.push(chunk);
    });
    stream.on("error", error => { if (!stopped) { stopped = true; reject(error); } });
    stream.on("end", () => {
      if (stopped) return;
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      try { resolve(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { reject(new Error("The document XML has an unsupported text encoding.")); }
    });
    stream.resume();
  });
}

export function documentFromOfficeXml(parts: Array<{ path: string; xml: string }>, format: "docx" | "odt"): ResumeDocument {
  const document = documentFromText("");
  document.source.format = format; document.source.extractor = `${format}-logical-xml`;
  document.source.warnings = ["Logical paragraphs, runs and table paths are preserved. Rendered page positions, pagination and generated list markers are unavailable."];
  if (parts.length > 1) document.source.warnings.push("Headers, footers and notes are included once as separate logical parts; their rendered placement is unknown.");
  let runs = 0; let chars = 0;
  for (const part of parts) {
    if (encoder.encode(part.xml).length > MAX_XML_BYTES || /<!DOCTYPE|<!ENTITY/i.test(part.xml)) throw new Error("This document XML is unsupported or too large.");
    const xml = new DOMParser().parseFromString(part.xml, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("This document contains malformed XML.");
    const paragraphs = format === "docx" ? Array.from(xml.getElementsByTagNameNS(WORD_NS, "p")) : Array.from(xml.getElementsByTagNameNS(TEXT_NS, "p")).concat(Array.from(xml.getElementsByTagNameNS(TEXT_NS, "h"))).sort(documentOrder);
    if (paragraphs.length > RESUME_LIMITS.maxBlocks) throw new Error("This document contains too many paragraphs.");
    for (const paragraph of paragraphs) {
      if (format === "docx" && hasAncestor(paragraph, WORD_NS, "del")) continue;
      const id = `paragraph${String(document.blocks.length + 1).padStart(4, "0")}`;
      const elements = format === "docx" ? Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "r")).filter(run => closestParagraph(run, WORD_NS) === paragraph && !hasAncestor(run, WORD_NS, "del")) : [paragraph];
      const blockRuns: ResumeRun[] = elements.map((element, index) => {
        if (++runs + document.blocks.length + 1 > RESUME_LIMITS.maxBlocks) throw new Error("This document contains too many text runs.");
        const text = logicalXmlText(element, format, paragraph, RESUME_LIMITS.maxTextCharacters - chars);
        chars += text.length;
        const run: ResumeRun = { id: `${id}-run${String(index + 1).padStart(4, "0")}`, text, sourcePath: `${part.path}${elementPath(element)}` };
        if (format === "docx") {
          const properties = Array.from(element.children).find(child => child.namespaceURI === WORD_NS && child.localName === "rPr");
          const property = (name: string) => properties?.getElementsByTagNameNS(WORD_NS, name)[0];
          const font = property("rFonts")?.getAttributeNS(WORD_NS, "ascii");
          const halfPoints = Number(property("sz")?.getAttributeNS(WORD_NS, "val"));
          if (font) run.fontName = font;
          if (Number.isFinite(halfPoints) && halfPoints > 0) run.fontSize = halfPoints / 2;
          for (const [name, key] of [["b", "bold"], ["i", "italic"]] as const) {
            const value = property(name); if (value) run[key] = !["0", "false", "off"].includes(value.getAttributeNS(WORD_NS, "val") || "1");
          }
        }
        return run;
      });
      const text = blockRuns.map(run => run.text).join("");
      if (document.blocks.length) chars++;
      if (runs + document.blocks.length + 1 > RESUME_LIMITS.maxBlocks || chars > RESUME_LIMITS.maxTextCharacters) throw new Error("This document contains too much text or too many text runs.");
      document.blocks.push({ id, page: null, text, readingOrder: document.blocks.length + 1, geometry: null, hasEOL: true, sourcePath: `${part.path}${elementPath(paragraph)}`, runs: blockRuns });
    }
    if (format === "docx" && xml.getElementsByTagNameNS(WORD_NS, "del").length) document.source.warnings.push("Tracked deletions are excluded from the readable text; the original file retains the revision markup.");
  }
  document.text = document.blocks.map(block => block.text).join("\n");
  document.source.status = document.text.trim() ? "ready" : "needs_text";
  if (!document.text.trim()) document.source.warnings.push("No readable document text was found; the original file is retained.");
  return validateDocument(document);
}

function documentOrder(left: Element, right: Element) { return left.compareDocumentPosition(right) & 4 ? -1 : left === right ? 0 : 1; }
function hasAncestor(node: Element, namespace: string, name: string) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) if (parent.namespaceURI === namespace && parent.localName === name) return true;
  return false;
}
function closestParagraph(node: Element, namespace: string) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) if (parent.namespaceURI === namespace && parent.localName === "p") return parent;
  return null;
}
function logicalXmlText(node: Node, format: "docx" | "odt", paragraph: Element, remaining: number): string {
  const pending = [node], parts: string[] = []; let size = 0;
  const append = (text: string) => {
    size += text.length;
    if (size > remaining) throw new Error("This document contains too much text. It has not been shortened.");
    parts.push(text);
  };
  while (pending.length) {
    const current = pending.pop()!;
    if (current.nodeType === 3) { if (format === "odt") append(current.nodeValue || ""); continue; }
    if (current.nodeType !== 1) continue;
    const element = current as Element;
    if (element !== paragraph && element.localName === "p" && [WORD_NS, TEXT_NS].includes(element.namespaceURI || "")) continue;
    if (format === "docx" && element.namespaceURI === WORD_NS) {
      if (element.localName === "del" || element.localName === "rPr") continue;
      if (element.localName === "t") { append(element.textContent || ""); continue; }
      if (element.localName === "tab") { append("\t"); continue; }
      if (["br", "cr"].includes(element.localName)) { append("\n"); continue; }
      if (element.localName === "noBreakHyphen") { append("\u2011"); continue; }
      if (element.localName === "softHyphen") { append("\u00ad"); continue; }
    }
    if (format === "odt" && element.namespaceURI === TEXT_NS) {
      if (element.localName === "s") {
        const count = Number(element.getAttributeNS(TEXT_NS, "c") || "1");
        if (!Number.isInteger(count) || count < 1 || count > remaining - size) throw new Error("Invalid or oversized repeated-space count in document.");
        append(" ".repeat(count)); continue;
      }
      if (element.localName === "tab") { append("\t"); continue; }
      if (element.localName === "line-break") { append("\n"); continue; }
    }
    pending.push(...Array.from(current.childNodes).reverse());
  }
  return parts.join("");
}
function elementPath(element: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(sibling => sibling.namespaceURI === node!.namespaceURI && sibling.localName === node!.localName) : [node];
    parts.unshift(`${node.tagName}[${siblings.indexOf(node) + 1}]`);
  }
  return `/${parts.join("/")}`;
}

/** RTF logical text parser: retains Unicode escapes, groups, tabs and paragraphs. */
export function rtfText(input: string): string {
  type State = { skip: boolean; uc: number };
  let state: State = { skip: false, uc: 1 }; const stack: State[] = []; const result: string[] = [];
  let fallback = 0; let size = 0;
  const emit = (text: string) => {
    if (state.skip) return;
    size += text.length;
    if (size > RESUME_LIMITS.maxTextCharacters) throw new Error("Resume text must be 50,000 characters or fewer. It has not been shortened.");
    result.push(text);
  };
  const append = (text: string) => { if (fallback > 0) { fallback--; return; } emit(text); };
  const controlWord = /([a-z]+)(-?\d+)? ?/iy;
  const skipped = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "datafield", "fldinst", "listtable", "listoverridetable", "generator"]);
  for (let index = 0; index < input.length;) {
    const char = input[index++];
    if (char === "{") { if (stack.length >= 256) throw new Error("This RTF file has too many nested groups."); stack.push({ ...state }); continue; }
    if (char === "}") { state = stack.pop() || { skip: false, uc: 1 }; continue; }
    if (char === "\r" || char === "\n") continue;
    if (char !== "\\") { append(char); continue; }
    const next = input[index];
    if (next === "'" && /^[0-9a-f]{2}$/i.test(input.slice(index + 1, index + 3))) {
      append(new TextDecoder("windows-1252").decode(Uint8Array.of(parseInt(input.slice(index + 1, index + 3), 16)))); index += 3; continue;
    }
    if (next && !/[a-z]/i.test(next)) {
      index++;
      if (next === "*") state.skip = true;
      else if (["\\", "{", "}"].includes(next)) append(next);
      else if (next === "~") append("\u00a0");
      else if (next === "_") append("\u2011");
      else if (next === "-") append("\u00ad");
      continue;
    }
    controlWord.lastIndex = index;
    const token = controlWord.exec(input);
    if (!token) continue;
    index += token[0].length; const word = token[1]; const number = Number(token[2]);
    if (skipped.has(word)) state.skip = true;
    else if (word === "uc" && Number.isInteger(number) && number >= 0 && number <= 16) state.uc = number;
    else if (word === "u" && token[2] !== undefined && Number.isInteger(number)) { emit(String.fromCharCode(number < 0 ? number + 65536 : number)); fallback = state.uc; }
    else if (word === "bin" && Number.isInteger(number) && number >= 0) index = Math.min(input.length, index + number);
    else if (["par", "line", "row"].includes(word)) append("\n");
    else if (["tab", "cell"].includes(word)) append("\t");
    else if (word === "emdash") append("\u2014");
    else if (word === "endash") append("\u2013");
    else if (word === "bullet") append("\u2022");
  }
  return result.join("");
}

function validateText(text: string) {
  if (text.length > RESUME_LIMITS.maxTextCharacters) throw new Error("Resume text must be 50,000 characters or fewer. It has not been shortened.");
  if (text.includes("\u0000")) throw new Error("The resume text contains unsupported binary characters. Paste readable text instead.");
}
function validateDocument(document: ResumeDocument) {
  validateText(document.text);
  if (document.blocks.reduce((sum, block) => sum + 1 + (block.runs?.length || 0), 0) > RESUME_LIMITS.maxBlocks) throw new Error("This resume contains too many text blocks or runs.");
  if (encoder.encode(JSON.stringify(document)).length > RESUME_LIMITS.maxDocumentBytes) throw new Error("The structured resume package exceeds 1 MiB. Choose a simpler resume file.");
  return document;
}
