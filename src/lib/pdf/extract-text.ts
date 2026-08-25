import { normalizeExtractedText } from "./parsing-utils";

export async function extractPdfText(data: Uint8Array): Promise<string> {
  // pdfjs (used by pdf-parse) evaluates a rendering helper that references
  // DOMMatrix even though this route only extracts text. Provide the minimal
  // constructor before loading pdf-parse so the Node runtime can initialize.
  const nodeGlobals = globalThis as unknown as { DOMMatrix?: unknown };
  nodeGlobals.DOMMatrix ??= class DOMMatrix {};

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return normalizeExtractedText(
      result.text.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, ""),
    );
  } finally {
    await parser.destroy();
  }
}
