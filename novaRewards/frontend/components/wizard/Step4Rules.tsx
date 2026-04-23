'use client';

import React from 'react';
import type { CampaignWizardData, ValidationError } from '@/types/campaign';
import {
  ValidationErrorDisplay,
  StepErrorSummary,
} from './ValidationError';
import { HelpTooltipWrapper } from './ContextualHelp';

interface Step4RulesProps {
  data: Partial<CampaignWizardData>;
  errors: ValidationError[];
  onDataChange: (updates: Partial<CampaignWizardData>) => void;
}

export function CampaignWizardStep4({
  data,
  errors,
  onDataChange,
}: Step4RulesProps) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      onDataChange({ [name]: checked });
    } else {
      const numValue = type === 'number' ? parseFloat(value) : value;
      onDataChange({ [name]: numValue || value });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Campaign Rules & Limits
        </h2>
        <p className="text-gray-600">
          Set operational limits and rules to control campaign impact and
          costs.
        </p>
      </div>

      <StepErrorSummary errors={errors} />

      {/* Maximum Participants */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Maximum Participants"
            description="Optional: Limit the total number of unique users who can participate. Leave empty for unlimited."
          >
            <span>Maximum Participants (Optional)</span>
          </HelpTooltipWrapper>
        </label>
        <input
          type="number"
          name="maxParticipants"
          value={data.maxParticipants || ''}
          onChange={handleChange}
          placeholder="Unlimited"
          min="1"
          step="1"
          className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
            errors.some((e) => e.field === 'maxParticipants' && e.type === 'error')
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
        />
        <ValidationErrorDisplay
          errors={errors}
          fieldName="maxParticipants"
        />
      </div>

      {/* Daily Cap */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Daily Cap"
            description="Optional: Maximum number of qualifying events per day. Prevents system abuse and controls daily spending."
          >
            <span>Daily Cap (Optional)</span>
          </HelpTooltipWrapper>
        </label>
        <input
          type="number"
          name="dailyCap"
          value={data.dailyCap || ''}
          onChange={handleChange}
          placeholder="Unlimited"
          min="1"
          step="1"
          className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
            errors.some((e) => e.field === 'dailyCap' && e.type === 'error')
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
        />
        <ValidationErrorDisplay errors={errors} fieldName="dailyCap" />
      </div>

      {/* Per-User Limit */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Per-User Limit"
            description="Optional: Maximum times a single user can earn rewards. Prevents power users from claiming entire reward pool."
          >
            <span>Per-User Claim Limit (Optional)</span>
          </HelpTooltipWrapper>
        </label>
        <input
          type="number"
          name="perUserLimit"
          value={data.perUserLimit || ''}
          onChange={handleChange}
          placeholder="Unlimited"
          min="1"
          step="1"
          className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
            errors.some((e) => e.field === 'perUserLimit' && e.type === 'error')
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
        />
        <ValidationErrorDisplay errors={errors} fieldName="perUserLimit" />
      </div>

      {/* Stacking Rules */}
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="stackable"
            checked={data.stackable || false}
            onChange={handleChange}
            className="w-5 h-5 border-gray-300 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <div className="font-semibold text-gray-900">
              <HelpTooltipWrapper
                title="Reward Stacking"
                description="Allow users to combine rewards from this campaign with rewards from other active campaigns."
              >
                <span>Allow Reward Stacking</span>
              </HelpTooltipWrapper>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              When enabled, users can earn rewards from multiple campaigns
              simultaneously. When disabled, only one campaign reward applies per
              action.
            </p>
          </div>
        </label>
      </div>

      {/* Active Status */}
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="active"
            checked={data.active || false}
            onChange={handleChange}
            className="w-5 h-5 border-blue-300 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <div className="font-semibold text-gray-900">
              <HelpTooltipWrapper
                title="Campaign Status"
                description="Enable this campaign to make it live and visible to customers. You can disable it anytime to pause rewards."
              >
                <span>Activate Campaign on Creation</span>
              </HelpTooltipWrapper>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              When disabled, you can manually activate the campaign later. Campaigns
              also automatically activate based on their start date.
            </p>
          </div>
        </label>
      </div>

      {/* Budget Summary */}
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>💰</span>
          Projected Budget Impact
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Reward per action:</span>
            <span className="font-medium">
              {data.rewardAmount} {data.rewardUnit || 'units'}
            </span>
          </div>
          {data.dailyCap && (
            <div className="flex justify-between">
              <span>Daily cost (at cap):</span>
              <span className="font-medium">
                {data.dailyCap * (data.rewardAmount || 0)} {data.rewardUnit}
              </span>
            </div>
          )}
          {data.maxRewardCap && (
            <div className="flex justify-between">
              <span>Max per user:</span>
              <span className="font-medium">
                {data.maxRewardCap} {data.rewardUnit}
              </span>
            </div>
          )}
          <p className="text-xs text-yellow-700 mt-2 italic">
            💡 Tip: Ensure you have sufficient budget before launching.
          </p>
        </div>
      </div>
    </div>
  );
}
