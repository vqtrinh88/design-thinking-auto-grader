import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { estimateWordCount } from './utils';

export type ExtractedEssay = {
  text: string;
  wordCount: number;
  extractedBy: 'text' | 'docx' | 'pdf-text' | 'raw' | 'none';
};

export async function extractEssayText(file: File): Promise<ExtractedEssay> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    const text = buffer.toString('utf-8');
    return { text, wordCount: estimateWordCount(text), extractedBy: 'text' };
  }

  if (lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    return { text, wordCount: estimateWordCount(text), extractedBy: 'docx' };
  }

  if (lowerName.endsWith('.pdf')) {
    const result = await pdfParse(buffer);
    const text = result.text || '';
    return { text, wordCount: estimateWordCount(text), extractedBy: 'pdf-text' };
  }

  return { text: '', wordCount: 0, extractedBy: 'none' };
}
