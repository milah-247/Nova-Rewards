'use client';

import React from 'react';
import type {
  CampaignWizardData,
  ValidationError,
  EligibilityRuleConfig,
} from '@/types/campaign';
import {
  ValidationErrorDisplay,
  StepErrorSummary,
} from './ValidationError';
import { HelpTooltipWrapper } from './ContextualHelp';

interface Step2TargetAudienceProps {
  data: Partial<CampaignWizardData>;
  errors: ValidationError[];
  onDataChange: (updates: Partial<CampaignWizardData>) => void;
}

export function CampaignWizardStep2({
  data,
  errors,
  onDataChange,
}: Step2TargetAudienceProps) {
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];

  const handleTierToggle = (tier: string) => {
    const currentTiers = data.targetTiers || [];
    const updatedTiers = currentTiers.includes(tier)
      ? currentTiers.filter((t) => t !== tier)
      : [...currentTiers, tier];
    onDataChange({ targetTiers: updatedTiers });
  };

  const handleAddRule = () => {
    const newRule: EligibilityRuleConfig = {
      type: 'user_tier',
      value: '',
      label: 'New Rule',
    };
    onDataChange({
      eligibilityRules: [...(data.eligibilityRules || []), newRule],
    });
  };

  const handleRemoveRule = (index: number) => {
    const updatedRules = data.eligibilityRules?.filter((_, i) => i !== index) || [];
    onDataChange({ eligibilityRules: updatedRules });
  };

  const handleMinPurchase = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDataChange({ minPurchaseAmount: parseFloat(e.target.value) || 0 });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Target Audience & Eligibility
        </h2>
        <p className="text-gray-600">
          Define who can participate in this campaign and what rules apply.
        </p>
      </div>

      <StepErrorSummary errors={errors} />

      {/* User Tier Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-4">
          <HelpTooltipWrapper
            title="Target User Tiers"
            description="Select which customer tiers can participate in this campaign. You can select multiple tiers to maximize reach."
          >
            <span>Target User Tiers *</span>
          </HelpTooltipWrapper>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiers.map((tier) => (
            <label
              key={tier}
              className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                data.targetTiers?.includes(tier)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={data.targetTiers?.includes(tier) || false}
                onChange={() => handleTierToggle(tier)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{tier}</div>
              </div>
              <div className="w-5 h-5 border-2 border-current rounded flex items-center justify-center">
                {data.targetTiers?.includes(tier) && (
                  <span className="text-blue-600">✓</span>
                )}
              </div>
            </label>
          ))}
        </div>
        <ValidationErrorDisplay errors={errors} fieldName="targetTiers" />
      </div>

      {/* Minimum Purchase Amount */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Minimum Purchase Amount"
            description="Optional: Set a minimum purchase amount required to be eligible for rewards. Leave empty for no minimum."
          >
            <span>Minimum Purchase Amount (Optional)</span>
          </HelpTooltipWrapper>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-gray-600 font-medium">
            $
          </span>
          <input
            type="number"
            value={data.minPurchaseAmount || ''}
            onChange={handleMinPurchase}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg font-medium hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Eligibility Rules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-semibold text-gray-900">
            <HelpTooltipWrapper
              title="Additional Eligibility Rules"
              description="Add complex eligibility conditions. Examples: geographic restrictions, account age requirements, or NSFW content restrictions."
            >
              <span>Additional Eligibility Rules (Optional)</span>
            </HelpTooltipWrapper>
          </label>
          <button
            type="button"
            onClick={handleAddRule}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            + Add Rule
          </button>
        </div>

        <div className="space-y-3">
          {data.eligibilityRules && data.eligibilityRules.length > 0 ? (
            data.eligibilityRules.map((rule, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{rule.label}</p>
                  <p className="text-sm text-gray-600">
                    Type: {rule.type} | Value: {rule.value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRule(index)}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-600 italic">
              No additional rules added. You can add rules to further restrict
              eligibility.
            </p>
          )}
        </div>
      </div>

      {/* Geographic Restrictions */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Geographic Restrictions"
            description="Optionally restrict campaign to specific countries or regions."
          >
            <span>Geographic Restrictions (Optional)</span>
          </HelpTooltipWrapper>
        </label>
        <input
          type="text"
          placeholder="e.g., US, CA, UK (comma-separated country codes)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave empty to allow all countries
        </p>
      </div>
    </div>
  );
}
