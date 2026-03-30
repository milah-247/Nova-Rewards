// Feature: nova-rewards, campaign routes
// Validates: Requirements 7.2, 7.3
// #94: Unit Tests for campaign routes

// Must be set before requiring server.js — stellarService reads ISSUER_PUBLIC
// at module load time to construct the NOVA Asset.
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL   = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock the db layer - keeps tests free of a real Postgres connection
jest.mock('../db/campaignRepository', () => ({
  validateCampaign: jest.requireActual('../db/campaignRepository').validateCampaign,
  validateCampaignUpdate: jest.requireActual('../db/campaignRepository').validateCampaignUpdate,
  createCampaign: jest.fn(),
  getCampaignsByMerchant: jest.fn(),
  getCampaignById: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  setCampaignActiveState: jest.fn(),
  getCampaignParticipants: jest.fn(),
}));

// Mock authenticateMerchant to inject a test merchant
jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    req.merchant = { id: 1, name: 'Test Merchant' };
    next();
  },
}));

// Mock emailService to avoid nodemailer dependency issues
jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn().mockResolvedValue({ success: true }),
}));

const app = require('../server');
const {
  createCampaign,
  getCampaignsByMerchant,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  setCampaignActiveState,
  getCampaignParticipants,
} = require('../db/campaignRepository');

// Shared valid payload
const VALID_BODY = {
  name: 'Summer Sale',
  rewardRate: 5,
  startDate: '2026-06-01',
  endDate: '2026-08-31',
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/campaigns
// ---------------------------------------------------------------------------
describe('POST /api/campaigns', () => {
  test('201 - creates campaign and returns it for valid input', async () => {
    const created = { id: 42, merchant_id: 1, ...VALID_BODY, is_active: true };
    createCampaign.mockResolvedValue(created);

    const res = await request(app).post('/api/campaigns').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: 42, name: 'Summer Sale' });
    expect(createCampaign).toHaveBeenCalledTimes(1);
  });

  test('400 - rejects when rewardRate is 0', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/reward/i);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when rewardRate is negative', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when rewardRate is not a number', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: 'free' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when endDate equals startDate', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-06-01', endDate: '2026-06-01' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/end/i);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when endDate is before startDate', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-08-01', endDate: '2026-06-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('400 - rejects when name is missing', async () => {
    const { name, ...body } = VALID_BODY;
    const res = await request(app).post('/api/campaigns').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campaigns
// ---------------------------------------------------------------------------
describe('GET /api/campaigns', () => {
  test('200 - returns campaigns for authenticated merchant', async () => {
    const campaigns = [
      { id: 1, merchant_id: 1, name: 'Spring Promo', reward_rate: 3 },
      { id: 2, merchant_id: 1, name: 'Flash Sale', reward_rate: 10 },
    ];
    getCampaignsByMerchant.mockResolvedValue(campaigns);

    const res = await request(app).get('/api/campaigns');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(getCampaignsByMerchant).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:campaignId
// ---------------------------------------------------------------------------
describe('GET /api/campaigns/:campaignId', () => {
  test('200 - returns a campaign by id', async () => {
    const campaign = { id: 5, merchant_id: 1, name: 'VIP Promo', reward_rate: 7 };
    getCampaignById.mockResolvedValue(campaign);

    const res = await request(app).get('/api/campaigns/5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(campaign);
    expect(getCampaignById).toHaveBeenCalledWith(5);
  });

  test('404 - returns not found for campaign owned by another merchant', async () => {
    getCampaignById.mockResolvedValue({ id: 5, merchant_id: 2, name: 'Other Promo' });

    const res = await request(app).get('/api/campaigns/5');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/campaigns/:campaignId
// ---------------------------------------------------------------------------
describe('PUT /api/campaigns/:campaignId', () => {
  test('200 - updates campaign fields', async () => {
    const updated = { id: 5, merchant_id: 1, name: 'Updated Promo', reward_rate: 8 };
    updateCampaign.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/campaigns/5')
      .send({ name: 'Updated Promo', rewardRate: 8 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(updated);
    expect(updateCampaign).toHaveBeenCalledWith({
      campaignId: 5,
      merchantId: 1,
      name: 'Updated Promo',
      rewardRate: 8,
      startDate: undefined,
      endDate: undefined,
    });
  });

  test('400 - rejects when no fields are provided', async () => {
    const res = await request(app).put('/api/campaigns/5').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/campaigns/:campaignId
// ---------------------------------------------------------------------------
describe('DELETE /api/campaigns/:campaignId', () => {
  test('200 - deletes a campaign', async () => {
    const deleted = { id: 5, merchant_id: 1, name: 'Old Promo' };
    deleteCampaign.mockResolvedValue(deleted);

    const res = await request(app).delete('/api/campaigns/5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(deleted);
    expect(deleteCampaign).toHaveBeenCalledWith(5, 1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns/:campaignId/activate and /pause
// ---------------------------------------------------------------------------
describe('POST /api/campaigns/:campaignId/activate', () => {
  test('200 - activates a campaign', async () => {
    const activated = { id: 5, merchant_id: 1, is_active: true };
    setCampaignActiveState.mockResolvedValue(activated);

    const res = await request(app).post('/api/campaigns/5/activate');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(activated);
    expect(setCampaignActiveState).toHaveBeenCalledWith(5, 1, true);
  });
});

describe('POST /api/campaigns/:campaignId/pause', () => {
  test('200 - pauses a campaign', async () => {
    const paused = { id: 5, merchant_id: 1, is_active: false };
    setCampaignActiveState.mockResolvedValue(paused);

    const res = await request(app).post('/api/campaigns/5/pause');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(paused);
    expect(setCampaignActiveState).toHaveBeenCalledWith(5, 1, false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:campaignId/participants
// ---------------------------------------------------------------------------
describe('GET /api/campaigns/:campaignId/participants', () => {
  test('200 - returns campaign participants', async () => {
    getCampaignById.mockResolvedValue({ id: 5, merchant_id: 1, name: 'Test' });
    getCampaignParticipants.mockResolvedValue([
      { id: 10, wallet_address: 'GABC', interaction_count: '2', total_amount: '50', last_activity_at: '2026-06-15T00:00:00.000Z' },
    ]);

    const res = await request(app).get('/api/campaigns/5/participants');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(getCampaignParticipants).toHaveBeenCalledWith(5);
  });
});
