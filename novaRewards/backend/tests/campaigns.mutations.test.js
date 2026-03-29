/**
 * Additional mutation-killing tests for campaign routes
 * These tests target boundary conditions and logical operator mutations
 */

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL   = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

jest.mock('../db/campaignRepository', () => ({
  validateCampaign: jest.requireActual('../db/campaignRepository').validateCampaign,
  createCampaign: jest.fn(),
  getCampaignsByMerchant: jest.fn(),
}));

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    req.merchant = { id: 1, name: 'Test Merchant' };
    next();
  },
}));

jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn().mockResolvedValue({ success: true }),
}));

const app = require('../server');
const { createCampaign, getCampaignsByMerchant } = require('../db/campaignRepository');

const VALID_BODY = {
  merchantId: 1,
  name: 'Summer Sale',
  rewardRate: 5,
  startDate: '2026-06-01',
  endDate: '2026-08-31',
};

beforeEach(() => jest.clearAllMocks());

describe('POST /api/campaigns - Mutation Killers', () => {
  test('rejects name as non-string type (number)', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/name/i);
  });

  test('rejects name as non-string type (array)', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, name: ['Summer Sale'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects name as non-string type (object)', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, name: { value: 'Summer Sale' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects name with only whitespace', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects name with only tabs', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, name: '\t\t\t' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects empty string name', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects rewardRate exactly at boundary 0', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('accepts rewardRate exactly at boundary 1', async () => {
    const created = { id: 42, ...VALID_BODY, rewardRate: 1, is_active: true };
    createCampaign.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: 1 });

    expect(res.status).toBe(201);
  });

  test('rejects rewardRate as string', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: '5' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects rewardRate as null', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, rewardRate: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects rewardRate as undefined', async () => {
    const { rewardRate, ...body } = VALID_BODY;
    const res = await request(app)
      .post('/api/campaigns')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects when startDate equals endDate exactly', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-06-01', endDate: '2026-06-01' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end/i);
  });

  test('accepts when endDate is one day after startDate', async () => {
    const created = { id: 42, ...VALID_BODY, is_active: true };
    createCampaign.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/campaigns')
      .send({ ...VALID_BODY, startDate: '2026-06-01', endDate: '2026-06-02' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/campaigns/:merchantId - Mutation Killers', () => {
  test('rejects merchantId exactly 0 (boundary)', async () => {
    const res = await request(app).get('/api/campaigns/0');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/positive integer/i);
  });

  test('accepts merchantId exactly 1 (boundary)', async () => {
    getCampaignsByMerchant.mockResolvedValue([]);

    const res = await request(app).get('/api/campaigns/1');

    expect(res.status).toBe(200);
    expect(getCampaignsByMerchant).toHaveBeenCalledWith(1);
  });

  test('rejects negative merchantId', async () => {
    const res = await request(app).get('/api/campaigns/-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects non-integer merchantId (decimal)', async () => {
    const res = await request(app).get('/api/campaigns/1.5');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects non-numeric merchantId (string)', async () => {
    const res = await request(app).get('/api/campaigns/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('rejects merchantId with special characters', async () => {
    const res = await request(app).get('/api/campaigns/1;DROP TABLE');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('handles very large merchantId', async () => {
    getCampaignsByMerchant.mockResolvedValue([]);

    const res = await request(app).get('/api/campaigns/999999999');

    expect(res.status).toBe(200);
    expect(getCampaignsByMerchant).toHaveBeenCalledWith(999999999);
  });

  test('verifies isNaN check catches NaN values', async () => {
    const res = await request(app).get('/api/campaigns/NaN');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('verifies <= 0 check (not just < 0)', async () => {
    const res = await request(app).get('/api/campaigns/0');

    expect(res.status).toBe(400);
    // This kills mutation: merchantId <= 0 → merchantId < 0
  });
});
