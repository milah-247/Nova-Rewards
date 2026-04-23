/**
 * Campaign Wizard Types
 * Defines all types used in the multi-step campaign creation wizard
 */

export type CampaignType = 'referral' | 'purchase' | 'engagement' | 'loyalty';
export type RewardType = 'points' | 'tokens' | 'discount';
export type EligibilityRule = 'user_tier' | 'minimum_purchase' | 'geographic' | 'custom';

export interface CampaignWizardData {
  // Step 1: Basic Information
  name: string;
  description: string;
  campaignType: CampaignType;
  startDate: string;
  endDate: string;

  // Step 2: Target Audience
  targetTiers: string[];
  eligibilityRules: EligibilityRuleConfig[];
  minPurchaseAmount?: number;
  geographicRestrictions?: string[];

  // Step 3: Rewards Configuration
  rewardType: RewardType;
  rewardAmount: number;
  rewardUnit: string;
  maxRewardCap?: number;
  tokenContractId?: string;
  tokenDecimals?: number;

  // Step 4: Campaign Rules
  maxParticipants?: number;
  dailyCap?: number;
  perUserLimit?: number;
  stackable: boolean;
  active: boolean;

  // Step 5: Review & Confirmation
  acknowledgedTerms: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EligibilityRuleConfig {
  type: EligibilityRule;
  value: string | number | string[];
  operator?: 'equals' | 'greater_than' | 'less_than' | 'includes';
  label: string;
}

export interface ValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  active: boolean;
}

export interface ContextualHelpItem {
  fieldName: string;
  title: string;
  description: string;
  examples?: string[];
  link?: string;
}

export interface CampaignWizardState {
  currentStep: number;
  data: Partial<CampaignWizardData>;
  validationErrors: ValidationError[];
  isLoading: boolean;
  isSubmitting: boolean;
}

export interface StepValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
