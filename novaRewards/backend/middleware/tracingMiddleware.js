'use strict';

const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');

/**
 * Generates a correlationId per request and propagates it through headers
 * and res.locals so all downstream code can attach it to log entries.
 * Satisfies #627 (correlation ID) and #366 (distributed tracing).
 */
function tracingMiddleware(req, res, next) {
  const correlationId = req.header('x-correlation-id') || req.header('x-trace-id') || uuidv4();

  req.correlationId = correlationId;
  res.locals.correlationId = correlationId;
  req.log = logger.withCorrelationId(correlationId);

  res.setHeader('x-correlation-id', correlationId);

  req.startTime = Date.now();
  next();
}

/**
 * Helper to log a trace span event (kept for backward-compat with #366 callers).
 */
function logSpan(req, name, attributes = {}) {
  const log = req.log || logger;
  log.debug('trace_span', {
    span: name,
    durationMs: Date.now() - (req.startTime || Date.now()),
    ...attributes,
  });
}

module.exports = { tracingMiddleware, logSpan };
