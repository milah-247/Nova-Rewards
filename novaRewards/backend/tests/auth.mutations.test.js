/**
 * Additional mutation-killing tests for auth routes
 * These tests target specific mutations that may survive basic testing
 */

jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('bcryptjs');
jest.mock('../services/tokenService', () => ({
  signAccessToken:  jest.fn(() => 'mock.access.token'),
  signRefreshToken: jest.fn(() => 'mock.refresh.token'),
}));

const http    = require('http');
const express = require('express');
const bcrypt  = require('bcryptjs');
const { query } = require('../db/index');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

function request(server, method, path, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const { port } = server.address();
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

const post = (server, path, payload) => request(server, 'POST', path, payload);

describe('Auth routes - Mutation Testing', () => {
  let server;

  beforeAll(() => new Promise(resolve => {
    server = http.createServer(buildApp()).listen(0, '127.0.0.1', resolve);
  }));

  afterAll(() => new Promise(resolve => server.close(resolve)));

  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // Boundary & Type Mutations
  // -------------------------------------------------------------------------
  describe('POST /api/auth/register - Mutation Killers', () => {
    const validBody = {
      email: 'jane@example.com',
      password: 'Str0ngPass!',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const dbRow = {
      id: 1,
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      role: 'user',
      created_at: new Date().toISOString(),
    };

    test('rejects non-string email (number)', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody,
        email: 12345,
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('rejects non-string email (object)', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody,
        email: { value: 'test@example.com' },
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('rejects non-string password (number)', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody,
        password: 12345678,
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('rejects firstName as non-string', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody,
        firstName: 123,
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('rejects lastName as non-string', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody,
        lastName: ['Doe'],
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('rejects password exactly 7 characters (boundary)', async () => {
      const { status, body } = await post(server, '/api/auth/register', {
        ...validBody,
        password: 'Pass123',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('accepts password exactly 8 characters (boundary)', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      const { status } = await post(server, '/api/auth/register', {
        ...validBody,
        password: 'Pass1234',
      });
      expect(status).toBe(201);
    });

    test('verifies bcrypt salt rounds is exactly 12', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      await post(server, '/api/auth/register', validBody);

      expect(bcrypt.hash).toHaveBeenCalledWith('Str0ngPass!', 12);
      expect(bcrypt.hash).not.toHaveBeenCalledWith('Str0ngPass!', 11);
      expect(bcrypt.hash).not.toHaveBeenCalledWith('Str0ngPass!', 10);
    });

    test('handles unexpected database errors (non-23505)', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed');
      const unexpectedError = new Error('Connection timeout');
      unexpectedError.code = 'ECONNREFUSED';
      query.mockRejectedValueOnce(unexpectedError);

      const { status, body } = await post(server, '/api/auth/register', validBody);

      expect(status).toBe(500);
      expect(body.success).toBe(false);
    });

    test('trims whitespace from email before normalization', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      await post(server, '/api/auth/register', {
        ...validBody,
        email: '  jane@example.com  ',
      });

      expect(query.mock.calls[0][1][0]).toBe('jane@example.com');
      expect(query.mock.calls[0][1][0]).not.toContain(' ');
    });

    test('trims whitespace from firstName', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      await post(server, '/api/auth/register', {
        ...validBody,
        firstName: '  Jane  ',
      });

      expect(query.mock.calls[0][1][2]).toBe('Jane');
    });

    test('trims whitespace from lastName', async () => {
      bcrypt.hash = jest.fn().mockResolvedValue('hashed');
      query.mockResolvedValueOnce({ rows: [dbRow] });

      await post(server, '/api/auth/register', {
        ...validBody,
        lastName: '  Doe  ',
      });

      expect(query.mock.calls[0][1][3]).toBe('Doe');
    });
  });

  // -------------------------------------------------------------------------
  // Login Mutation Killers
  // -------------------------------------------------------------------------
  describe('POST /api/auth/login - Mutation Killers', () => {
    const validBody = { email: 'jane@example.com', password: 'Str0ngPass!' };

    const dbUser = {
      id: 1,
      email: 'jane@example.com',
      password_hash: '$2b$12$hashedpassword',
      first_name: 'Jane',
      last_name: 'Doe',
      role: 'user',
    };

    test('rejects non-string email type', async () => {
      const { status, body } = await post(server, '/api/auth/login', {
        email: 123,
        password: 'Str0ngPass!',
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('rejects non-string password type', async () => {
      const { status, body } = await post(server, '/api/auth/login', {
        email: 'jane@example.com',
        password: 12345678,
      });
      expect(status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    test('verifies timing attack mitigation with dummy hash', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      bcrypt.compare = jest.fn()
        .mockResolvedValueOnce(false) // First call with DUMMY_HASH
        .mockResolvedValueOnce(false);

      const { status } = await post(server, '/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'Str0ngPass!',
      });

      expect(status).toBe(401);
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Str0ngPass!',
        expect.stringMatching(/^\$2b\$12\$/)
      );
    });

    test('verifies both user existence AND password match required', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const { status, body } = await post(server, '/api/auth/login', validBody);

      expect(status).toBe(401);
      expect(body.error).toBe('invalid_credentials');
      // Mutation: changing || to && in (!user || !passwordMatch)
      // This test ensures both conditions are checked
    });

    test('returns 401 when user exists but password wrong (not 400)', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const { status } = await post(server, '/api/auth/login', {
        ...validBody,
        password: 'WrongPass1',
      });

      expect(status).toBe(401);
      expect(status).not.toBe(400);
    });

    test('returns 401 when user not found (not 404)', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const { status } = await post(server, '/api/auth/login', {
        email: 'ghost@example.com',
        password: 'Str0ngPass!',
      });

      expect(status).toBe(401);
      expect(status).not.toBe(404);
    });

    test('verifies accessToken is included in response', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const { body } = await post(server, '/api/auth/login', validBody);

      expect(body.data.accessToken).toBeDefined();
      expect(body.data.accessToken).toBe('mock.access.token');
      expect(typeof body.data.accessToken).toBe('string');
    });

    test('verifies refreshToken is included in response', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const { body } = await post(server, '/api/auth/login', validBody);

      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.refreshToken).toBe('mock.refresh.token');
      expect(typeof body.data.refreshToken).toBe('string');
    });

    test('verifies user object is included in response', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const { body } = await post(server, '/api/auth/login', validBody);

      expect(body.data.user).toBeDefined();
      expect(body.data.user.id).toBe(1);
      expect(body.data.user.email).toBe('jane@example.com');
    });

    test('ensures password_hash is never exposed in response', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const { body } = await post(server, '/api/auth/login', validBody);

      expect(body.data.user.password_hash).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('password_hash');
    });

    test('trims and lowercases email with mixed whitespace', async () => {
      query.mockResolvedValueOnce({ rows: [dbUser] });
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      await post(server, '/api/auth/login', {
        email: '  JANE@EXAMPLE.COM  ',
        password: 'Str0ngPass!',
      });

      expect(query.mock.calls[0][1][0]).toBe('jane@example.com');
    });
  });
});
