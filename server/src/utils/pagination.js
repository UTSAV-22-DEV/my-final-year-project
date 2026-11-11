import { AppError } from './AppError.js';

export function pagination(query) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(400, 'Use a positive page and a limit between 1 and 100.', 'VALIDATION_ERROR');
  return { page, limit, skip: (page - 1) * limit };
}
export const pageInfo = (total, page, limit) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
