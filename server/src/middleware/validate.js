import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

export function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => typeof req.body?.[field] !== 'string' || !req.body[field].trim());
    if (missing.length) return next(new AppError(400, `Required text fields: ${missing.join(', ')}.`, 'VALIDATION_ERROR'));
    next();
  };
}

export function validateObjectId(param = 'id') {
  return (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params[param])) {
      return next(new AppError(400, 'A valid record ID is required.', 'INVALID_ID'));
    }
    next();
  };
}
