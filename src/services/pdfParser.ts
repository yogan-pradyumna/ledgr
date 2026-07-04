import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedTransaction } from '../types';
import { parseTransactions } from './llmParser';

// Use the bundled worker via a local URL so Vite serves it correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PAGES_PER_BATCH = 3;

/** Extract text from each page of a PDF, returning one string per page. */
async function extractPagesFromPDF(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => 'str' in item)
      .map((item) => ({ str: (item as { str: string }).str, y: (item as { transform: number[] }).transform[5] }));
    items.sort((a, b) => b.y - a.y || 0);
    pages.push(items.map((i) => i.str).join(' '));
  }

  return pages;
}

/** Parse pasted text with the configured LLM. Re-exported for use by PasteImportTab. */
export async function parseWithLLM(text: string): Promise<ParsedTransaction[]> {
  return parseTransactions(text);
}

/** Parse a PDF file in batches of pages to avoid LLM output token limits.
 *  onProgress(batchIndex, totalBatches) is called before each batch. */
export async function parsePDFStatement(
  file: File,
  onProgress?: (batch: number, total: number) => void,
): Promise<ParsedTransaction[]> {
  const pages = await extractPagesFromPDF(file);

  const batches: string[] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_BATCH) {
    batches.push(pages.slice(i, i + PAGES_PER_BATCH).join('\n\n--- PAGE BREAK ---\n\n'));
  }

  const all: ParsedTransaction[] = [];
  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i + 1, batches.length);
    const parsed = await parseTransactions(batches[i]);
    all.push(...parsed);
  }

  return all;
}
