/**
 * Express global error handling middleware.
 * Ensures all uncaught route exceptions return valid formatted JSON responses.
 */
module.exports = (err, req, res, next) => {
  console.error('[Error Handler] Caught server-side error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
