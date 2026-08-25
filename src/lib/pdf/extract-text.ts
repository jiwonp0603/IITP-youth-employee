import { PDFParse } from "pdf-parse";
import { normalizeExtractedText } from "./parsing-utils";

export async function extractPdfText(data: Uint8Array): Promise<string> {
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
