declare module 'pdf-parse' {
  type PDFData = {
    numpages: number;
    numrender: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
    text: string;
  };

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PDFData>;
  export default pdfParse;
}
