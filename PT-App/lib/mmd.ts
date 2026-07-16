export type MmdTag = { raw: string; delimiter: "<% %>" | "<< >>"; name: string };

const ANGLE_PERCENT = /<%([\s\S]*?)%>/g;
const DOUBLE_CHEVRON = /<<([\s\S]*?)>>/g;

export function extractTags(text: string): MmdTag[] {
  const tags: MmdTag[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(ANGLE_PERCENT)) {
    if (!seen.has(match[0])) {
      seen.add(match[0]);
      tags.push({ raw: match[0], delimiter: "<% %>", name: match[1].trim() });
    }
  }
  for (const match of text.matchAll(DOUBLE_CHEVRON)) {
    if (!seen.has(match[0])) {
      seen.add(match[0]);
      tags.push({ raw: match[0], delimiter: "<< >>", name: match[1].trim() });
    }
  }
  return tags;
}

export function normalizeMmdText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function pdfToMmdText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(line);
  }
  return normalizeMmdText(pages.join("\n\n"));
}

type MammothModule = {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};

export async function docxToMmdText(file: File): Promise<string> {
  const mod: unknown = await import("mammoth/mammoth.browser");
  const mammoth = ((mod as { default?: MammothModule }).default ?? mod) as MammothModule;
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return normalizeMmdText(result.value);
}

export async function fileToMmdText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return pdfToMmdText(file);
  if (name.endsWith(".docx")) return docxToMmdText(file);
  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files aren't supported — save the file as .docx and try again.");
  }
  throw new Error("Unsupported file type — drop a PDF or Word (.docx) document.");
}
