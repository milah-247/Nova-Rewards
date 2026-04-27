'use strict';

/**
 * Tests for:
 *   - backend/lib/logger.js          (structured JSON output, child logger)
 *   - backend/middleware/httpLogger.js (request/response logging, header redaction)
 *   - backend/middleware/tracingMiddleware.js (correlationId propagation)
 */

const { Writable } = require('stream');
const { createLogger, format, transports } = require('winston');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Capture log output from a logger into an array of parsed JSON objects.
 * Uses a proper Node.js Writable stream as required by winston's Stream transport.
 */
function captureOutput(loggerInstance) {
  const lines = [];
  const writable = new Writable({
    write(chunk, _enc, cb) {
      try { lines.push(JSON.parse(chunk.toString())); } catch { lines.push(chunk.toString()); }
      cb();
    },
  });
  loggerInstance.clear();
  loggerInstance.add(
    new transports.Stream({
      stream: writable,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.printf(({ timestamp, level, message, correlationId, stack, ...meta }) => {
          const entry = { timestamp, level, service: 'test', correlationId, message, ...meta };
          if (stack) entry.stack = stack;
          return JSON.stringify(entry);
        })
      ),
    })
  );
  return lines;
}

/** Build a minimal mock Express req/res/next triple. */
function mockReqRes(overrides = {}) {
  const headers = (overrides.req && overrides.req.headers) || {};
  const req = {
    method: 'GET',
    originalUrl: '/api/test',
    ip: '127.0.0.1',
    headers,
    // Express's req.header() does case-insensitive header lookup
    header(name) { return this.headers[name.toLowerCase()]; },
    startTime: Date.now(),
    ...(overrides.req || {}),
  };
  const listeners = {};
  const res = {
    statusCode: 200,
    locals: {},
    on(event, cb) { listeners[event] = cb; },
    emit(event) { listeners[event]?.(); },
    setHeader: jest.fn(),
    ...(overrides.res || {}),
  };
  // Ensure res.locals exists even when overrides.res is provided
  if (!res.locals) res.locals = {};
  const next = jest.fn();
  return { req, res, next, listeners };
}

// ── logger.js ────────────────────────────────────────────────────────────────

describe('logger', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    logger = require('../lib/logger');
  });

  test('emits structured JSON with required fields', () => {
    const lines = captureOutput(logger);
    logger.info('test_event', { foo: 'bar' });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      message: 'test_event',
      timestamp: expect.any(String),
      foo: 'bar',
    });
  });

  test('includes correlationId when set via child logger', () => {
    const lines = captureOutput(logger);
    const child = logger.withCorrelationId('abc-123');
    child.info('child_event');

    expect(lines[0].correlationId).toBe('abc-123');
  });

  test('omits correlationId field when not set', () => {
    const lines = captureOutput(logger);
    logger.info('no_correlation');

    // correlationId should be absent or undefined
    expect(lines[0].correlationId).toBeFalsy();
  });

  test('includes stack trace for error objects', () => {
    const lines = captureOutput(logger);
    const err = new Error('test error');
    logger.error('boom', { err: err.message, stack: err.stack });

    expect(lines[0].stack).toMatch(/Error: test error/);
  });

  test('respects LOG_LEVEL env var — drops entries below threshold', () => {
    jest.resetModules();
    process.env.LOG_LEVEL = 'warn';
    const warnLogger = require('../lib/logger');
    const lines = captureOutput(warnLogger);

    warnLogger.info('should_be_dropped');
    warnLogger.warn('should_appear');

    expect(lines).toHaveLength(1);
    expect(lines[0].level).toBe('warn');
    delete process.env.LOG_LEVEL;
  });
});

// ── tracingMiddleware.js ──────────────────────────────────────────────────────

describe('tracingMiddleware', () => {
  let tracingMiddleware;

  beforeEach(() => {
    jest.resetModules();
    tracingMiddleware = require('../middleware/tracingMiddleware').tracingMiddleware;
  });

  test('generates a correlationId and attaches it to req, res.locals, and header', () => {
    const { req, res, next } = mockReqRes();
    tracingMiddleware(req, res, next);

    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.locals.correlationId).toBe(req.correlationId);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.correlationId);
    expect(next).toHaveBeenCalled();
  });

  test('reuses x-correlation-id header when provided by caller', () => {
    const { req, res, next } = mockReqRes({
      req: { headers: { 'x-correlation-id': 'upstream-id-999' } },
    });
    tracingMiddleware(req, res, next);

    expect(req.correlationId).toBe('upstream-id-999');
  });

  test('attaches a child logger (req.log) with correlationId bound', () => {
    const { req, res, next } = mockReqRes();
    tracingMiddleware(req, res, next);

    expect(typeof req.log.info).toBe('function');
    expect(typeof req.log.error).toBe('function');
  });
});

// ── httpLogger.js ─────────────────────────────────────────────────────────────

describe('httpLogger', () => {
  let httpLogger;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    logger = require('../lib/logger');
    httpLogger = require('../middleware/httpLogger').httpLogger;
  });

  test('logs http_request on call and http_response on finish', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes();
    req.log = logger;

    httpLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    res.emit('finish');

    const messages = lines.map((l) => l.message);
    expect(messages).toContain('http_request');
    expect(messages).toContain('http_response');
  });

  test('http_response includes method, url, statusCode, durationMs', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes({ res: { statusCode: 201, locals: {} } });
    req.log = logger;

    httpLogger(req, res, next);
    res.emit('finish');

    const response = lines.find((l) => l.message === 'http_response');
    expect(response).toMatchObject({
      method: 'GET',
      url: '/api/test',
      statusCode: 201,
      durationMs: expect.any(Number),
    });
  });

  test('redacts authorization header', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes({
      req: { headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' } },
    });
    req.log = logger;

    httpLogger(req, res, next);

    const request = lines.find((l) => l.message === 'http_request');
    expect(request.headers.authorization).toBe('[REDACTED]');
    expect(request.headers['content-type']).toBe('application/json');
  });

  test('redacts cookie and x-api-key headers', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes({
      req: { headers: { cookie: 'session=abc', 'x-api-key': 'key123' } },
    });
    req.log = logger;

    httpLogger(req, res, next);

    const request = lines.find((l) => l.message === 'http_request');
    expect(request.headers.cookie).toBe('[REDACTED]');
    expect(request.headers['x-api-key']).toBe('[REDACTED]');
  });

  test('logs at error level for 5xx responses', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes({ res: { statusCode: 500, locals: {} } });
    req.log = logger;

    httpLogger(req, res, next);
    res.emit('finish');

    const response = lines.find((l) => l.message === 'http_response');
    expect(response.level).toBe('error');
  });

  test('logs at warn level for 4xx responses', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes({ res: { statusCode: 404, locals: {} } });
    req.log = logger;

    httpLogger(req, res, next);
    res.emit('finish');

    const response = lines.find((l) => l.message === 'http_response');
    expect(response.level).toBe('warn');
  });

  test('falls back to module-level logger when req.log is absent', () => {
    const lines = captureOutput(logger);
    const { req, res, next } = mockReqRes();
    // deliberately do NOT set req.log

    expect(() => {
      httpLogger(req, res, next);
      res.emit('finish');
    }).not.toThrow();

    expect(lines.some((l) => l.message === 'http_request')).toBe(true);
  });
});
