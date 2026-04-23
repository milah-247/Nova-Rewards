'use client';

import React from 'react';
import type { CampaignWizardData, ValidationError } from '@/types/campaign';
import {
  ValidationErrorDisplay,
  StepErrorSummary,
} from './ValidationError';
import { HelpTooltipWrapper } from './ContextualHelp';

interface Step1BasicInfoProps {
  data: Partial<CampaignWizardData>;
  errors: ValidationError[];
  onDataChange: (updates: Partial<CampaignWizardData>) => void;
}

export function CampaignWizardStep1({
  data,
  errors,
  onDataChange,
}: Step1BasicInfoProps) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    onDataChange({ [name]: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Campaign Basic Information
        </h2>
        <p className="text-gray-600">
          Let&apos;s start with the essential details about your campaign.
        </p>
      </div>

      <StepErrorSummary errors={errors} />

      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Campaign Name"
            description="Choose a clear, memorable name for your campaign. This will be displayed to customers and in your dashboard."
          >
            <span>Campaign Name *</span>
          </HelpTooltipWrapper>
        </label>
        <input
          type="text"
          name="name"
          value={data.name || ''}
          onChange={handleChange}
          placeholder="e.g., Summer Referral Boost 2024"
          maxLength={100}
          className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
            errors.some((e) => e.field === 'name' && e.type === 'error')
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
        />
        <div className="mt-1 flex justify-between items-start">
          <ValidationErrorDisplay errors={errors} fieldName="name" />
          <span className="text-xs text-gray-500">
            {data.name?.length || 0}/100
          </span>
        </div>
      </div>

      {/* Campaign Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Campaign Description"
            description="Provide details about what the campaign is for, how customers benefit, and any special terms. This helps merchants understand the context."
          >
            <span>Campaign Description *</span>
          </HelpTooltipWrapper>
        </label>
        <textarea
          name="description"
          value={data.description || ''}
          onChange={handleChange}
          placeholder="Describe the campaign, eligibility criteria, and key benefits for participants..."
          rows={5}
          className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
            errors.some((e) => e.field === 'description' && e.type === 'error')
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none`}
        />
        <ValidationErrorDisplay errors={errors} fieldName="description" />
      </div>

      {/* Campaign Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          <HelpTooltipWrapper
            title="Campaign Type"
            description="Select the type of campaign. Each type has different triggering mechanisms and reward eligibility rules."
          >
            <span>Campaign Type *</span>
          </HelpTooltipWrapper>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {['referral', 'purchase', 'engagement', 'loyalty'].map((type) => (
            <label
              key={type}
              className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                data.campaignType === type
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="campaignType"
                value={type}
                checked={data.campaignType === type}
                onChange={handleChange}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 capitalize">
                  {type}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {type === 'referral' && 'Reward users for referring others'}
                  {type === 'purchase' && 'Reward users for making purchases'}
                  {type === 'engagement' && 'Reward users for engagement activities'}
                  {type === 'loyalty' && 'Long-term loyalty rewards program'}
                </div>
              </div>
            </label>
          ))}
        </div>
        <ValidationErrorDisplay errors={errors} fieldName="campaignType" />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <HelpTooltipWrapper
              title="Start Date"
              description="When should this campaign become active? Campaigns cannot start in the past."
            >
              <span>Start Date *</span>
            </HelpTooltipWrapper>
          </label>
          <input
            type="datetime-local"
            name="startDate"
            value={data.startDate || ''}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
              errors.some((e) => e.field === 'startDate' && e.type === 'error')
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
          />
          <ValidationErrorDisplay errors={errors} fieldName="startDate" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <HelpTooltipWrapper
              title="End Date"
              description="When should this campaign end? The end date must be after the start date."
            >
              <span>End Date *</span>
            </HelpTooltipWrapper>
          </label>
          <input
            type="datetime-local"
            name="endDate"
            value={data.endDate || ''}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg font-medium transition-colors ${
              errors.some((e) => e.field === 'endDate' && e.type === 'error')
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white`}
          />
          <ValidationErrorDisplay errors={errors} fieldName="endDate" />
        </div>
      </div>
    </div>
  );
}
