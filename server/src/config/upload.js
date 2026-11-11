import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from './env.js';
import { AppError } from '../utils/AppError.js';

const documentTypes = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function filterDocument(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!documentTypes[extension] || documentTypes[extension] !== file.mimetype) {
    return callback(new AppError(415, 'Upload a PDF or DOCX document with its correct content type.', 'UNSUPPORTED_FILE_TYPE'));
  }
  callback(null, true);
}

// Storage is private. Future upload/download routes must authorize ownership first
// and inspect document contents; MIME/extension checks alone do not prove file safety.
const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(config.uploadDir, { recursive: true }, (error) => callback(error, config.uploadDir));
  },
  filename(req, file, callback) {
    callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: filterDocument,
  limits: { fileSize: config.maxFileSize, files: 1, fields: 10, parts: 11 },
});
