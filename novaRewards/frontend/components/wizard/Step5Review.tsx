'use client';

import React from 'react';
import type { CampaignWizardData, ValidationError } from '@/types/campaign';
import {
  ValidationErrorDisplay,
  StepErrorSummary,
} from './ValidationError';
import { HelpTooltipWrapper } from './ContextualHelp';

interface Step5ReviewProps {
  data: Partial<CampaignWizardData>;
  errors: ValidationError[];
  onDataChange: (updates: Partial<CampaignWizardData>) => void;
  isSubmitting?: boolean;
}

export function CampaignWizardStep5({
  data,
  errors,
  onDataChange,
  isSubmitting,
}: Step5ReviewProps) {
  const handleCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = e.target;
    onDataChange({ [name]: checked });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Review & Confirm
        </h2>
        <p className="text-gray-600">
          Review all campaign details before launching. You can always edit
          these settings later.
        </p>
      </div>

      <StepErrorSummary errors={errors} />

      {/* Campaign Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information Card */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>📋</span>
            Basic Information
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Campaign Name</p>
              <p className="font-medium text-gray-900">{data.name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-600">Type</p>
              <p className="font-medium text-gray-900 capitalize">
                {data.campaignType || '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Duration</p>
              <p className="font-medium text-gray-900">
                {formatDate(data.startDate)} to {formatDate(data.endDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Audience Card */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>👥</span>
            Target Audience
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Target Tiers</p>
              <p className="font-medium text-gray-900">
                {data.targetTiers?.length ? data.targetTiers.join(', ') : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Min Purchase</p>
              <p className="font-medium text-gray-900">
                {data.minPurchaseAmount ? `$${data.minPurchaseAmount}` : 'None'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Additional Rules</p>
              <p className="font-medium text-gray-900">
                {data.eligibilityRules?.length || 0} rule(s)
              </p>
            </div>
          </div>
        </div>

        {/* Rewards Card */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>🎁</span>
            Rewards
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Reward Type</p>
              <p className="font-medium text-gray-900 capitalize">
                {data.rewardType || '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Amount</p>
              <p className="font-medium text-gray-900">
                {data.rewardAmount} {data.rewardUnit}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Max Cap</p>
              <p className="font-medium text-gray-900">
                {data.maxRewardCap ? `${data.maxRewardCap} ${data.rewardUnit}` : 'No limit'}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Rules Card */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>⚙️</span>
            Campaign Rules
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600">Max Participants</p>
              <p className="font-medium text-gray-900">
                {data.maxParticipants || 'Unlimited'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Daily Cap</p>
              <p className="font-medium text-gray-900">
                {data.dailyCap || 'Unlimited'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Per-User Limit</p>
              <p className="font-medium text-gray-900">
                {data.perUserLimit || 'Unlimited'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Stacking</p>
              <p className="font-medium text-gray-900">
                {data.stackable ? '✓ Allowed' : '✕ Not allowed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description Preview */}
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {data.description || 'No description provided'}
        </p>
      </div>

      {/* Terms & Conditions */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">
          Terms & Conditions
        </h3>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="acknowledgedTerms"
              checked={data.acknowledgedTerms || false}
              onChange={handleCheckboxChange}
              className="w-5 h-5 border-blue-300 rounded text-blue-600 focus:ring-2 focus:ring-blue-500 mt-1 flex-shrink-0"
            />
            <div>
              <p className="text-sm text-gray-700">
                I understand and agree to the{' '}
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Nova Rewards Campaign Terms
                </a>
                {'. '}I acknowledge that:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                <li>Campaign settings cannot be changed once activated</li>
                <li>
                  I am responsible for ensuring sufficient budget allocation
                </li>
                <li>Participants must be verified before reward disbursement</li>
                <li>
                  All rewards are non-refundable and non-transferable unless
                  specified
                </li>
              </ul>
            </div>
          </label>
          <ValidationErrorDisplay
            errors={errors}
            fieldName="acknowledgedTerms"
          />
        </div>
      </div>

      {/* Important Notes */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800 font-medium mb-2">
          ⚠️ Important Notes:
        </p>
        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
          <li>Campaign will be live after you click "Confirm & Launch"</li>
          <li>Performance can be monitored in your dashboard</li>
          <li>You can pause the campaign at any time</li>
          <li>Never share campaign contract IDs or sensitive data publicly</li>
        </ul>
      </div>

      {/* Loading State Info */}
      {isSubmitting && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <span className="animate-spin">⏳</span>
          <p className="text-sm text-blue-800">
            Setting up your campaign... This may take a few moments.
          </p>
        </div>
      )}
    </div>
  );
}
