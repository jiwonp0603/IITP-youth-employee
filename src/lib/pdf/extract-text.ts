import { normalizeExtractedText } from "./parsing-utils";

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(Buffer.from(data));
  return normalizeExtractedText(
    result.text.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, ""),
  );
}
