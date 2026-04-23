const { v4: uuidv4 } = require('uuid');
const { client: redis } = require('../lib/redis');
const { Keypair, StrKey } = require('stellar-sdk');
const { query } = require('../db/index');
const { signAccessToken, signRefreshToken } = require('./tokenService');

/**
 * Validates that a string is a valid Stellar public key.
 * @param {string} address
 * @returns {boolean}
 */
function isValidStellarAddress(address) {
  if (typeof address !== 'string') return false;
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Generates a unique nonce for the given wallet address and stores it in Redis.
 * @param {string} walletAddress
 * @returns {Promise<string>} nonce
 */
async function generateChallenge(walletAddress) {
  if (!isValidStellarAddress(walletAddress)) {
    throw new Error('Invalid Stellar address');
  }

  const nonce = uuidv4();
  // Store nonce with a 5-minute expiry
  await redis.set(`auth_challenge:${walletAddress}`, nonce, {
    EX: 300
  });
  
  return nonce;
}

/**
 * Verifies the signed nonce and returns JWT tokens.
 * @param {string} walletAddress
 * @param {string} signature - Base64 encoded signature
 * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
 */
async function verifySignature(walletAddress, signature) {
  if (!isValidStellarAddress(walletAddress)) {
    throw new Error('Invalid Stellar address');
  }

  const nonce = await redis.get(`auth_challenge:${walletAddress}`);
  if (!nonce) {
    const error = new Error('Challenge expired or not found');
    error.status = 401;
    error.code = 'challenge_expired';
    throw error;
  }

  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
    // Verify the signature against the nonce
    const isValid = keypair.verify(Buffer.from(nonce), Buffer.from(signature, 'base64'));
    
    if (!isValid) {
      const error = new Error('Invalid signature');
      error.status = 401;
      error.code = 'invalid_signature';
      throw error;
    }

    // Success - delete nonce to prevent replay attacks
    await redis.del(`auth_challenge:${walletAddress}`);

    // Find user or create if they don't exist
    let result = await query(
      'SELECT id, wallet_address, role, email, first_name, last_name FROM users WHERE wallet_address = $1 AND is_deleted = FALSE',
      [walletAddress]
    );

    let user;
    if (result.rows.length === 0) {
      // Create lightweight user record
      const insertResult = await query(
        'INSERT INTO users (wallet_address) VALUES ($1) RETURNING id, wallet_address, role',
        [walletAddress]
      );
      user = insertResult.rows[0];
    } else {
      user = result.rows[0];
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        role: user.role,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    };
  } catch (err) {
    if (err.status) throw err;
    
    console.error('[StellarAuth] Verification error:', err);
    const error = new Error('Verification failed');
    error.status = 401;
    error.code = 'verification_failed';
    throw error;
  }
}

module.exports = {
  isValidStellarAddress,
  generateChallenge,
  verifySignature
};
