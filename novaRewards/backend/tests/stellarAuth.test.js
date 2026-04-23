const { Keypair } = require('stellar-sdk');
const { generateChallenge, verifySignature } = require('../services/stellarAuthService');
const { client: redis } = require('../lib/redis');
const { query } = require('../db/index');
const tokenService = require('../services/tokenService');

// Mock dependencies
jest.mock('../lib/redis', () => ({
  client: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }
}));

jest.mock('../db/index', () => ({
  query: jest.fn(),
}));

jest.mock('../services/tokenService', () => ({
  signAccessToken: jest.fn(() => 'mock.access.token'),
  signRefreshToken: jest.fn(() => 'mock.refresh.token'),
}));

describe('Stellar Authentication Service', () => {
  const walletAddress = 'GB567H6L23W7J3R67E3A3H2D36H57F3A3H2D36H57F3A3H2D36H57F3A'; // Random valid G address
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChallenge', () => {
    it('should generate a nonce and store it in Redis', async () => {
      redis.set.mockResolvedValue('OK');

      const nonce = await generateChallenge(publicKey);

      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(redis.set).toHaveBeenCalledWith(
        `auth_challenge:${publicKey}`,
        nonce,
        { EX: 300 }
      );
    });

    it('should throw error for invalid Stellar address', async () => {
      await expect(generateChallenge('invalid-address')).rejects.toThrow('Invalid Stellar address');
    });
  });

  describe('verifySignature', () => {
    it('should verify signature and return tokens for existing user', async () => {
      const nonce = 'test-nonce';
      const signature = keypair.sign(Buffer.from(nonce)).toString('base64');

      redis.get.mockResolvedValue(nonce);
      redis.del.mockResolvedValue(1);
      query.mockResolvedValue({
        rows: [{ id: 1, wallet_address: publicKey, role: 'user' }]
      });

      const result = await verifySignature(publicKey, signature);

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('mock.refresh.token');
      expect(result.user.walletAddress).toBe(publicKey);
      expect(redis.del).toHaveBeenCalledWith(`auth_challenge:${publicKey}`);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [publicKey]
      );
    });

    it('should create new user if not found', async () => {
      const nonce = 'test-nonce';
      const signature = keypair.sign(Buffer.from(nonce)).toString('base64');

      redis.get.mockResolvedValue(nonce);
      query
        .mockResolvedValueOnce({ rows: [] }) // Find user
        .mockResolvedValueOnce({ rows: [{ id: 2, wallet_address: publicKey, role: 'user' }] }); // Create user

      const result = await verifySignature(publicKey, signature);

      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO users'),
        [publicKey]
      );
      expect(result.user.id).toBe(2);
    });

    it('should throw 401 if nonce is not found', async () => {
      redis.get.mockResolvedValue(null);

      try {
        await verifySignature(publicKey, 'some-sig');
        fail('Should have thrown 401');
      } catch (err) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('challenge_expired');
      }
    });

    it('should throw 401 for invalid signature', async () => {
      const nonce = 'test-nonce';
      redis.get.mockResolvedValue(nonce);

      try {
        await verifySignature(publicKey, 'invalid-signature-base64');
        fail('Should have thrown 401');
      } catch (err) {
        expect(err.status).toBe(401);
        expect(err.code).toBe('invalid_signature');
      }
    });
  });
});
