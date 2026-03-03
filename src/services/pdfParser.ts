import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedTransaction } from '../types';
import { parseTransactions } from './llmParser';

// Use the bundled worker via a local URL so Vite serves it correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/** Extract all text from a PDF file, page by page. */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Preserve relative positioning by grouping items with Y-coordinate proximity
    const items = content.items
      .filter((item) => 'str' in item)
      .map((item) => ({ str: (item as { str: string }).str, y: (item as { transform: number[] }).transform[5] }));

    // Sort by Y descending (top of page first), then X ascending
    items.sort((a, b) => b.y - a.y || 0);
    pageTexts.push(items.map((i) => i.str).join(' '));
  }

  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
}

/** Parse pasted text with the configured LLM. Re-exported for use by PasteImportTab. */
export async function parseWithLLM(text: string): Promise<ParsedTransaction[]> {
  return parseTransactions(text);
}

/** Main entry point: parse a PDF file into a list of transactions for review. */
export async function parsePDFStatement(file: File): Promise<ParsedTransaction[]> {
  const text = await extractTextFromPDF(file);
  return parseTransactions(text);
}
