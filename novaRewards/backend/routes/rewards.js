const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { recordTransaction } = require('../db/transactionRepository');
const { listRewards } = require('../db/adminRepository');
const { getUserBalance } = require('../db/pointTransactionRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { authenticateUser } = require('../middleware/authenticateUser');
const { verifyTrustline } = require('../../blockchain/trustline');

/**
 * Rate limiter: max 20 requests per minute per IP on the distribute endpoint.
 * Closes: #123
 */
const distributeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
  },
});

/**
 * POST /api/rewards/distribute
 * Distributes NOVA tokens to a customer wallet.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.4, 7.5
 */
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const rewards = await listRewards();
    const userPoints = await getUserBalance(req.user.id);

    res.json({
      success: true,
      data: {
        rewards,
        userPoints: Number(userPoints),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/distribute', distributeRateLimiter, authenticateMerchant, async (req, res, next) => {
  try {
    const walletAddress = req.body.customerWallet || req.body.walletAddress;
    const { amount, campaignId } = req.body;

    if (!walletAddress || !amount || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'customerWallet, amount, and campaignId are required',
      });
    }

    const amountNumber = Number(amount);
    const campaignIdNumber = Number(campaignId);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Amount must be a positive number',
      });
    }

    if (!Number.isInteger(campaignIdNumber) || campaignIdNumber <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'campaignId must be a positive integer',
      });
    }

    if (!isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'customerWallet must be a valid Stellar public key',
      });
    }

    const campaignExists = await getCampaignById(campaignIdNumber);
    if (!campaignExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign does not exist',
      });
    }

    const campaign = await getActiveCampaign(campaignIdNumber);
    if (!campaign) {
      return res.status(400).json({
        success: false,
        error: 'invalid_campaign',
        message: 'Campaign is expired or inactive',
      });
    }

    if (campaign.merchant_id !== req.merchant.id) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Campaign does not belong to this merchant',
      });
    }

    const hasTrustline = await verifyTrustline(walletAddress);
    if (!hasTrustline) {
      return res.status(400).json({
        success: false,
        error: 'no_trustline',
        message: 'Recipient does not have a NOVA trustline. Please add NOVA trustline first.',
      });
    }

    const result = await distributeRewards({
      toWallet: walletAddress,
      amount: amountNumber,
    });

    const transaction = await recordTransaction({
      txHash: result.txHash,
      txType: 'distribution',
      amount: amountNumber,
      fromWallet: process.env.DISTRIBUTION_PUBLIC || null,
      toWallet: walletAddress,
      merchantId: req.merchant.id,
      campaignId: campaignIdNumber,
    });

    res.json({
      success: true,
      data: {
        txHash: result.txHash,
        transaction,
      },
    });
  } catch (err) {
    if (err.code === 'no_trustline') {
      return res.status(400).json({
        success: false,
        error: 'no_trustline',
        message: err.message,
      });
    }

    console.error('Error distributing rewards:', err);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: err.message || 'Failed to distribute rewards',
    });
  }
});

module.exports = router;