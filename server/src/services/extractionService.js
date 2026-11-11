import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { config } from '../config/env.js';
import { documentPath, inspectDocx } from './documentService.js';
import { AppError } from '../utils/AppError.js';

export const maxExtractedCharacters = 200000;
export async function extractDocumentText(metadata) {
  const filename = documentPath(metadata.storageKey);
  let buffer;
  try {
    const stat = await fs.stat(filename);
    if (stat.size > Math.min(config.maxFileSize, 10 * 1024 * 1024)) throw new AppError(413, 'AI evaluation accepts documents up to 10 MB or the configured upload limit, whichever is smaller.', 'DOCUMENT_TOO_LARGE');
    buffer = await fs.readFile(filename);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(404, 'The stored document is unavailable.', 'FILE_NOT_FOUND');
  }
  if (!buffer.length) throw new AppError(422, 'The document is empty.', 'EMPTY_DOCUMENT');
  let result;
  try {
    if (metadata.mimeType === 'application/pdf' && metadata.storageKey.endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer });
      try {
        const info = await parser.getInfo();
        if (info.total > 200) throw new AppError(413, 'AI evaluation accepts reports up to 200 pages.', 'DOCUMENT_TOO_LARGE');
        const extracted = await parser.getText();
        result = extracted.pages.map((page) => page.text).join('\n\n');
      } finally { await parser.destroy(); }
    } else if (metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && metadata.storageKey.endsWith('.docx')) {
      inspectDocx(buffer);
      result = (await mammoth.extractRawText({ buffer })).value;
    } else throw new AppError(415, 'Only PDF and DOCX documents can be evaluated.', 'UNSUPPORTED_FILE_TYPE');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'This document cannot be read. It may be corrupted, encrypted or unsupported.', 'UNREADABLE_DOCUMENT');
  }
  const text = result.replaceAll('\u0000', '').trim();
  if (!text) throw new AppError(422, metadata.mimeType === 'application/pdf' ? 'No extractable text was found. Scanned PDFs require OCR, which is not available.' : 'This document has no readable text.', 'NO_EXTRACTABLE_TEXT');
  if (text.length > maxExtractedCharacters) throw new AppError(413, 'The extracted report exceeds 200,000 characters. Shorten the report before evaluation.', 'DOCUMENT_TOO_LARGE');
  return text;
}
