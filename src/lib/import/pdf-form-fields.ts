// Reads a PDF's form-field values. D&D Beyond exports carry every character
// value as a named AcroForm field rather than as flowed text.

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';

// Point the worker at the real file for server-side (and script) usage.
GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

export interface PdfFormFields {
  /** Field name → trimmed value. Empty and "Off" fields are omitted; a repeated name keeps its last value. */
  fields: Record<string, string>;
  /** Field names in PDF annotation order (first occurrence). Spell headers and rows interleave, so levels come from this order. */
  order: string[];
}

export async function extractFormFields(data: Uint8Array): Promise<PdfFormFields> {
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const fields: Record<string, string> = {};
  const order: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    for (const a of await page.getAnnotations()) {
      if (!a.fieldName || a.fieldValue == null) continue;
      const name = a.fieldName.trim();
      const value = a.fieldValue.toString().trim();
      if (!value || value === 'Off') continue;
      if (!(name in fields)) order.push(name);
      fields[name] = value;
    }
  }

  return { fields, order };
}
