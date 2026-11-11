import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // HTML forms cannot set this header; cross-origin scripts require an allowed preflight.
  if (req.get('X-FYP-Request') !== '1' || (req.get('Origin') && !config.trustedOrigins.includes(req.get('Origin')))) {
    return next(new AppError(403, 'This request origin could not be verified.', 'CSRF_REJECTED'));
  }
  next();
}
