'use client';

import React from 'react';
import type { CampaignWizardData, ValidationError } from '@/types/campaign';
import {
  ValidationErrorDisplay,
  StepErrorSummary,
} from './ValidationError';
import { HelpTooltipWrapper } from './ContextualHelp';

interface Step3RewardsProps {
  data: Partial<CampaignWizardData>;
  errors: ValidationError[];
  onDataChange: (updates: Partial<CampaignWizardData>) => void;
}

export function CampaignWizardStep3({
  data,
  errors,
  onDataChange,
}: Step3RewardsProps) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const numValue = type === 'number' ? parseFloat(value) : value;
    onDataChange({ [name]: numValue || value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Rewards Configuration
        </h2>
        <p className="text-gray-600">
          Define what rewards participants will receive and how they&apos;re
          calculated.
        </p>
      </div>

      <StepErrorSummary errors={errors} />

      {/* Reward Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-4">
          <HelpTooltipWrapper
            title="Reward Type"
            description="Choose how customers will be rewarded. Points accumulate in their account, Tokens are blockchain assets, Discount codes provide instant savings."
          >
            <span>Reward Type *</span>
          </HelpTooltipWrapper>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['points', 'tokens', 'discount'].map((type) => (
            <label
              key={type}
              className={`relative flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                data.rewardType === type
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="rewardType"
                value={type}
                checked={data.rewardType === type}
                onChange={handleChange}
                className="sr-only"
              />
              <div className="text-3xl mb-3">
                {type === 'points' && '⭐'}
                {type === 'tokens' && '🪙'}
                {type === 'discount' && '🏷️'}
              </div>
              <div className="font-medium text-gray-900 capitalize mb-1">
                {type === 'points' && 'Loyalty Points'}
                {type === 'tokens' && 'Tokens'}
                {type === 'discount' && 'Discount Code'}
              </div>
              <div className="text-xs text-gray-600 text-center">
                {type === 'points' && 'Redeemable in-platform'}
                {type === 'tokens' && 'Blockchain-based rewards'}
                {type === 'discount' && 'One-time coupon codes'}
              </div>
            </label>
          ))}
        </div>
        <ValidationErrorDisplay errors={errors} fieldName="rewardType" />
      </div>

      {/* Reward Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <HelpTooltipWrapper
              title="Reward Amount"
              description="The amount of reward each participant receives per action or purchase."
            >
              <span>Reward Amount *</span>
            </HelpTooltipWrapper>
          </label>
          <input
            type="number"
            name="rewardAmount"
            value={data.rewardAmount || ''}
            onChange={handleChange}
            placeholder="0"
            step="0.01"
            min="0"
            className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
              errors.some((e) => e.field === 'rewardAmount' && e.type === 'error')
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
          />
          <ValidationErrorDisplay
            errors={errors}
            fieldName="rewardAmount"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <HelpTooltipWrapper
              title="Reward Unit"
              description="The unit of measurement for your rewards (e.g., 'points', 'NOVA tokens', 'USD')."
            >
              <span>Reward Unit</span>
            </HelpTooltipWrapper>
          </label>
          <input
            type="text"
            name="rewardUnit"
            value={data.rewardUnit || ''}
            onChange={handleChange}
            placeholder={
              data.rewardType === 'points'
                ? 'points'
                : data.rewardType === 'tokens'
                  ? 'NOVA'
                  : 'USD'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Maximum Reward Cap */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Maximum Reward Cap"
            description="Optional: Set a maximum total reward per participant. Prevents excessive spending on any single user."
          >
            <span>Maximum Reward Cap per User (Optional)</span>
          </HelpTooltipWrapper>
        </label>
        <input
          type="number"
          name="maxRewardCap"
          value={data.maxRewardCap || ''}
          onChange={handleChange}
          placeholder="No limit"
          step="0.01"
          min="0"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave empty for no cap. Recommended: 5-10x the average reward.
        </p>
      </div>

      {/* Token Configuration */}
      {data.rewardType === 'tokens' && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-900">Token Configuration</h3>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              <HelpTooltipWrapper
                title="Token Contract ID"
                description="The Stellar blockchain contract ID for the token you want to distribute."
              >
                <span>Token Contract ID *</span>
              </HelpTooltipWrapper>
            </label>
            <input
              type="text"
              name="tokenContractId"
              value={data.tokenContractId || ''}
              onChange={handleChange}
              placeholder="CAB7EDFE...XXX"
              className={`w-full px-4 py-3 border rounded-lg font-mono text-sm transition-colors ${
                errors.some((e) => e.field === 'tokenContractId' && e.type === 'error')
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
            />
            <ValidationErrorDisplay
              errors={errors}
              fieldName="tokenContractId"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              <HelpTooltipWrapper
                title="Token Decimals"
                description="Number of decimal places for the token. Most tokens use 7 decimals (standard for Stellar)."
              >
                <span>Token Decimals</span>
              </HelpTooltipWrapper>
            </label>
            <input
              type="number"
              name="tokenDecimals"
              value={data.tokenDecimals || 7}
              onChange={handleChange}
              min="0"
              max="18"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
