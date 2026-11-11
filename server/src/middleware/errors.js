import multer from 'multer';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.' } });
}

// Express requires all four parameters to identify error-handling middleware.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message;
  if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = error.code;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'The document exceeds the upload size limit.' : 'Invalid file upload.';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The submitted data is invalid.';
  } else if (error.code === 11000) {
    status = 409;
    code = 'DUPLICATE_RECORD';
    message = 'A record with these unique fields already exists.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body must contain valid JSON.';
  }
  if (status >= 500) {
    // Do not log error messages that might contain credentials or connection URIs.
    console.error(`[server] ${error.name || 'Error'} (${status})`);
    message = status === 503 ? 'This service is not configured or is temporarily unavailable.' : 'An unexpected server error occurred.';
  }
  res.status(status).json({ error: { code, message } });
}
