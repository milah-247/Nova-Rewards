'use strict';

const logger = require('../lib/logger');

// Headers that must never appear in logs
const REDACTED = new Set(['authorization', 'cookie', 'x-api-key']);

function sanitizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = REDACTED.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

/**
 * Logs every inbound request and its response.
 * Attaches to req.log (child logger with correlationId) set by tracingMiddleware.
 * Must be mounted AFTER tracingMiddleware.
 */
function httpLogger(req, res, next) {
  const log = req.log || logger;

  log.info('http_request', {
    method: req.method,
    url: req.originalUrl,
    headers: sanitizeHeaders(req.headers),
    ip: req.ip,
  });

  res.on('finish', () => {
    const durationMs = Date.now() - (req.startTime || Date.now());
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[level]('http_response', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}

module.exports = { httpLogger };
