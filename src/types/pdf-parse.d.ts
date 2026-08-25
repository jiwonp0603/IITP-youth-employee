declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
  };

  type PdfParse = (data: Buffer) => Promise<PdfParseResult>;

  const pdfParse: PdfParse;
  export default pdfParse;
}
