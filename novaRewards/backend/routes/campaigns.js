const router = require('express').Router();
const {
  validateCampaign,
  validateCampaignUpdate,
  createCampaign,
  getCampaignsByMerchant,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  setCampaignActiveState,
  getCampaignParticipants,
} = require('../db/campaignRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

function parseCampaignId(req, res) {
  const campaignId = parseInt(req.params.campaignId, 10);
  if (isNaN(campaignId) || campaignId <= 0) {
    res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'campaignId must be a positive integer',
    });
    return null;
  }
  return campaignId;
}

/**
 * POST /api/campaigns
 * Creates a new reward campaign after validating inputs.
 * Requirements: 7.2, 7.3
 */
router.post('/', authenticateMerchant, async (req, res, next) => {
  try {
    const { name, rewardRate, startDate, endDate } = req.body;
    const merchantId = req.merchant.id;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'name is required',
      });
    }

    const { valid, errors } = validateCampaign({ rewardRate, startDate, endDate });
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: errors.join('; '),
      });
    }

    const campaign = await createCampaign({
      merchantId,
      name: name.trim(),
      rewardRate,
      startDate,
      endDate,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns
 * Returns all campaigns for the authenticated merchant.
 * Requirements: 7.2
 */
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    const campaigns = await getCampaignsByMerchant(req.merchant.id);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns/:campaignId/participants
 * Returns participant summaries for campaign activity.
 */
router.get('/:campaignId/participants', authenticateMerchant, async (req, res, next) => {
  try {
    const campaignId = parseCampaignId(req, res);
    if (!campaignId) return;

    const campaign = await getCampaignById(campaignId);
    if (!campaign || campaign.merchant_id !== req.merchant.id) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
    }

    const participants = await getCampaignParticipants(campaignId);
    res.json({ success: true, data: participants });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:campaignId/activate
 * Sets a campaign to active.
 */
router.post('/:campaignId/activate', authenticateMerchant, async (req, res, next) => {
  try {
    const campaignId = parseCampaignId(req, res);
    if (!campaignId) return;

    const campaign = await setCampaignActiveState(campaignId, req.merchant.id, true);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:campaignId/pause
 * Sets a campaign to inactive.
 */
router.post('/:campaignId/pause', authenticateMerchant, async (req, res, next) => {
  try {
    const campaignId = parseCampaignId(req, res);
    if (!campaignId) return;

    const campaign = await setCampaignActiveState(campaignId, req.merchant.id, false);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns/:campaignId
 * Returns a campaign by id.
 */
router.get('/:campaignId', authenticateMerchant, async (req, res, next) => {
  try {
    const campaignId = parseCampaignId(req, res);
    if (!campaignId) return;

    const campaign = await getCampaignById(campaignId);
    if (!campaign || campaign.merchant_id !== req.merchant.id) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/campaigns/:campaignId
 * Updates campaign fields.
 */
router.put('/:campaignId', authenticateMerchant, async (req, res, next) => {
  try {
    const campaignId = parseCampaignId(req, res);
    if (!campaignId) return;

    if ('is_active' in req.body) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Use activate/pause routes to change campaign state',
      });
    }

    const { name, rewardRate, startDate, endDate } = req.body;
    if (name === undefined && rewardRate === undefined && startDate === undefined && endDate === undefined) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'At least one update field is required',
      });
    }

    const { valid, errors } = validateCampaignUpdate({ name, rewardRate, startDate, endDate });
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: errors.join('; '),
      });
    }

    const campaign = await updateCampaign({
      campaignId,
      merchantId: req.merchant.id,
      name,
      rewardRate,
      startDate,
      endDate,
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/campaigns/:campaignId
 * Deletes a campaign by id.
 */
router.delete('/:campaignId', authenticateMerchant, async (req, res, next) => {
  try {
    const campaignId = parseCampaignId(req, res);
    if (!campaignId) return;

    const campaign = await deleteCampaign(campaignId, req.merchant.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
