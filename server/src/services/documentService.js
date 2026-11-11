import fs from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function documentPath(storageKey) {
  if (!/^[a-zA-Z0-9_-]+\.(pdf|docx)$/.test(storageKey || '')) throw new AppError(400, 'Invalid document reference.', 'INVALID_DOCUMENT');
  const result = path.resolve(config.uploadDir, storageKey);
  if (path.dirname(result) !== path.resolve(config.uploadDir)) throw new AppError(400, 'Invalid document reference.', 'INVALID_DOCUMENT');
  return result;
}

export function inspectDocx(buffer) {
  let unpacked;
  try {
    let total = 0; let entries = 0;
    unpacked = unzipSync(buffer, { filter: (entry) => {
      total += entry.originalSize; entries++;
      if (total > 40 * 1024 * 1024 || entry.originalSize > 10 * 1024 * 1024 || entries > 2000) throw new Error('Expanded document limit exceeded.');
      return ['word/document.xml', '[Content_Types].xml'].includes(entry.name);
    } });
  } catch { throw new AppError(422, 'The DOCX document is corrupt or exceeds the expanded document limit.', 'INVALID_DOCUMENT'); }
  if (!unpacked['word/document.xml'] || !unpacked['[Content_Types].xml']) throw new AppError(422, 'Upload a valid Word DOCX document.', 'INVALID_DOCUMENT');
  return unpacked;
}

export async function inspectDocument(file) {
  if (!file) throw new AppError(400, 'Choose a PDF or DOCX document.', 'FILE_REQUIRED');
  const buffer = await fs.readFile(documentPath(file.filename));
  if (buffer.length === 0) throw new AppError(422, 'The document is empty.', 'INVALID_DOCUMENT');
  if (file.filename.endsWith('.pdf')) {
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new AppError(422, 'This file does not have a valid PDF signature.', 'INVALID_DOCUMENT');
  } else inspectDocx(buffer);
  return { originalName: path.basename(file.originalname).replace(/[\r\n]/g, '').slice(0, 255), storageKey: file.filename, mimeType: file.mimetype, size: file.size };
}

export async function discardUpload(file) {
  if (file) await fs.unlink(documentPath(file.filename)).catch(() => {});
}

export async function downloadDocument(res, metadata) {
  const filename = documentPath(metadata.storageKey);
  try { await fs.access(filename); } catch { throw new AppError(404, 'The stored document is missing. Contact your supervisor.', 'FILE_NOT_FOUND'); }
  res.set('Cache-Control', 'private, no-store');
  await new Promise((resolve, reject) => res.download(filename, metadata.originalName, { dotfiles: 'allow' }, (error) => error ? reject(error) : resolve()));
}
