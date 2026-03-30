const express = require('express');
const request = require('supertest');
const { Keypair, StrKey } = require('stellar-sdk');

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    req.merchant = { id: 1 };
    next();
  },
}));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 42 };
    next();
  },
}));

jest.mock('../db/campaignRepository', () => ({
  getCampaignById: jest.fn(),
  getActiveCampaign: jest.fn(),
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
}));

jest.mock('../db/adminRepository', () => ({
  listRewards: jest.fn(),
}));

jest.mock('../db/pointTransactionRepository', () => ({
  getUserBalance: jest.fn(),
}));

jest.mock('../../blockchain/sendRewards', () => ({
  distributeRewards: jest.fn(),
}));

jest.mock('../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn((addr) => {
    try {
      return StrKey.isValidEd25519PublicKey(addr);
    } catch {
      return false;
    }
  }),
}));

jest.mock('../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn(),
}));

const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { recordTransaction } = require('../db/transactionRepository');
const { listRewards } = require('../db/adminRepository');
const { getUserBalance } = require('../db/pointTransactionRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { verifyTrustline } = require('../../blockchain/trustline');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rewards', require('../routes/rewards'));
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

describe('Rewards route', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    process.env.DISTRIBUTION_PUBLIC = 'GCFXU5PVP2QYUK3F6P2SZKP5GWN2Q4SNCZEMOC5W3G3IYQC4SMK7D4XJQ';
  });

  test('GET /api/rewards returns active reward list and user points', async () => {
    listRewards.mockResolvedValue([
      { id: 1, name: 'Coffee', pointCost: 50, cost: '50', stock: 10, category: null, description: null, image: null, isActive: true },
    ]);
    getUserBalance.mockResolvedValue(375);

    const response = await request(app)
      .get('/api/rewards')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      rewards: [
        { id: 1, name: 'Coffee', pointCost: 50, stock: 10 },
      ],
      userPoints: 375,
    });
    expect(listRewards).toHaveBeenCalledTimes(1);
    expect(getUserBalance).toHaveBeenCalledWith(42);
  });

  test('POST /api/rewards/distribute records transaction after successful distribution', async () => {
    const recipient = Keypair.random().publicKey();
    getCampaignById.mockResolvedValue({ id: 1, merchant_id: 1 });
    getActiveCampaign.mockResolvedValue({ id: 1, merchant_id: 1, is_active: true });
    verifyTrustline.mockResolvedValue(true);
    distributeRewards.mockResolvedValue({ txHash: 'tx-hash-123' });
    recordTransaction.mockResolvedValue({ id: 7, tx_hash: 'tx-hash-123' });

    const response = await request(app)
      .post('/api/rewards/distribute')
      .send({ customerWallet: recipient, amount: '12.5', campaignId: 1 })
      .set('x-api-key', 'test-api-key');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({ txHash: 'tx-hash-123' });
    expect(distributeRewards).toHaveBeenCalledWith({ toWallet: recipient, amount: 12.5 });
    expect(recordTransaction).toHaveBeenCalledWith(expect.objectContaining({
      txHash: 'tx-hash-123',
      txType: 'distribution',
      amount: 12.5,
      toWallet: recipient,
      merchantId: 1,
      campaignId: 1,
    }));
  });
});
