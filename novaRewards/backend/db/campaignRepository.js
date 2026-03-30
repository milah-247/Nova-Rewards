const { query } = require('./index');

/**
 * Validates campaign input fields before creation.
 * Requirements: 7.3
 *
 * @param {object} params
 * @param {number|string} params.rewardRate
 * @param {string} params.startDate  - ISO date string e.g. "2025-01-01"
 * @param {string} params.endDate    - ISO date string e.g. "2025-12-31"
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCampaign({ rewardRate, startDate, endDate }) {
  const errors = [];

  if (rewardRate === undefined || rewardRate === null || isNaN(Number(rewardRate))) {
    errors.push('rewardRate must be a number');
  } else if (Number(rewardRate) <= 0) {
    errors.push('rewardRate must be greater than 0');
  }

  if (!startDate || !endDate) {
    errors.push('startDate and endDate are required');
  } else {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('startDate and endDate must be valid dates');
    } else if (end <= start) {
      errors.push('endDate must be strictly after startDate');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates partial campaign updates.
 *
 * @param {object} params
 * @param {string} [params.name]
 * @param {number|string} [params.rewardRate]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCampaignUpdate({ name, rewardRate, startDate, endDate }) {
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      errors.push('name must be a non-empty string');
    }
  }

  if (rewardRate !== undefined) {
    if (rewardRate === null || isNaN(Number(rewardRate))) {
      errors.push('rewardRate must be a number');
    } else if (Number(rewardRate) <= 0) {
      errors.push('rewardRate must be greater than 0');
    }
  }

  const hasStartDate = startDate !== undefined;
  const hasEndDate = endDate !== undefined;
  if (hasStartDate || hasEndDate) {
    if (!hasStartDate || !hasEndDate) {
      errors.push('startDate and endDate must both be provided when updating dates');
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push('startDate and endDate must be valid dates');
      } else if (end <= start) {
        errors.push('endDate must be strictly after startDate');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a new reward campaign in the database.
 * Requirements: 7.2
 *
 * @param {object} params
 * @param {number} params.merchantId
 * @param {string} params.name
 * @param {number|string} params.rewardRate
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @returns {Promise<object>} The created campaign row
 */
async function createCampaign({ merchantId, name, rewardRate, startDate, endDate }) {
  const result = await query(
    `INSERT INTO campaigns (merchant_id, name, reward_rate, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [merchantId, name, rewardRate, startDate, endDate]
  );
  return result.rows[0];
}

/**
 * Returns all campaigns for a given merchant.
 * Requirements: 7.2, 10.1
 *
 * @param {number} merchantId
 * @returns {Promise<object[]>}
 */
async function getCampaignsByMerchant(merchantId) {
  const result = await query(
    'SELECT * FROM campaigns WHERE merchant_id = $1 ORDER BY created_at DESC',
    [merchantId]
  );
  return result.rows;
}

/**
 * Returns a campaign by id regardless of active/expired state.
 *
 * @param {number} campaignId
 * @returns {Promise<object|null>}
 */
async function getCampaignById(campaignId) {
  const result = await query(
    'SELECT * FROM campaigns WHERE id = $1',
    [campaignId]
  );
  return result.rows[0] || null;
}

/**
 * Returns a campaign only if it is active and not expired.
 * Requirements: 7.4, 7.5
 *
 * @param {number} campaignId
 * @returns {Promise<object|null>} Campaign row or null if inactive/expired
 */
async function getActiveCampaign(campaignId) {
  const result = await query(
    `SELECT * FROM campaigns
     WHERE id = $1
       AND is_active = TRUE
       AND end_date >= CURRENT_DATE`,
    [campaignId]
  );
  return result.rows[0] || null;
}

/**
 * Updates campaign fields for a merchant.
 *
 * @param {object} params
 * @param {number} params.campaignId
 * @param {number} params.merchantId
 * @param {string} [params.name]
 * @param {number|string} [params.rewardRate]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @returns {Promise<object|null>} Updated campaign or null if not found
 */
async function updateCampaign({ campaignId, merchantId, name, rewardRate, startDate, endDate }) {
  const fields = [];
  const values = [];
  let index = 1;

  if (name !== undefined) {
    fields.push(`name = $${index++}`);
    values.push(name.trim());
  }
  if (rewardRate !== undefined) {
    fields.push(`reward_rate = $${index++}`);
    values.push(rewardRate);
  }
  if (startDate !== undefined && endDate !== undefined) {
    fields.push(`start_date = $${index++}`);
    values.push(startDate);
    fields.push(`end_date = $${index++}`);
    values.push(endDate);
  }

  if (fields.length === 0) {
    throw new Error('No update fields provided');
  }

  const result = await query(
    `UPDATE campaigns SET ${fields.join(', ')}
     WHERE id = $${index++} AND merchant_id = $${index}
     RETURNING *`,
    [...values, campaignId, merchantId]
  );

  return result.rows[0] || null;
}

/**
 * Deletes a campaign belonging to a merchant.
 *
 * @param {number} campaignId
 * @param {number} merchantId
 * @returns {Promise<object|null>} Deleted campaign row or null if not found
 */
async function deleteCampaign(campaignId, merchantId) {
  const result = await query(
    `DELETE FROM campaigns
     WHERE id = $1 AND merchant_id = $2
     RETURNING *`,
    [campaignId, merchantId]
  );
  return result.rows[0] || null;
}

/**
 * Sets the campaign active state for a merchant.
 *
 * @param {number} campaignId
 * @param {number} merchantId
 * @param {boolean} isActive
 * @returns {Promise<object|null>} Updated campaign row or null if not found
 */
async function setCampaignActiveState(campaignId, merchantId, isActive) {
  const result = await query(
    `UPDATE campaigns
     SET is_active = $1
     WHERE id = $2 AND merchant_id = $3
     RETURNING *`,
    [isActive, campaignId, merchantId]
  );
  return result.rows[0] || null;
}

/**
 * Lists unique participants for a campaign.
 *
 * @param {number} campaignId
 * @returns {Promise<object[]>}
 */
async function getCampaignParticipants(campaignId) {
  const result = await query(
    `SELECT
       u.id,
       u.wallet_address,
       COUNT(p.*) AS interaction_count,
       SUM(p.amount) AS total_amount,
       MAX(p.created_at) AS last_activity_at
     FROM point_transactions p
     JOIN users u ON u.id = p.user_id
     WHERE p.campaign_id = $1
     GROUP BY u.id, u.wallet_address
     ORDER BY last_activity_at DESC`,
    [campaignId]
  );
  return result.rows;
}

module.exports = {
  validateCampaign,
  validateCampaignUpdate,
  createCampaign,
  getCampaignsByMerchant,
  getCampaignById,
  getActiveCampaign,
  updateCampaign,
  deleteCampaign,
  setCampaignActiveState,
  getCampaignParticipants,
};
