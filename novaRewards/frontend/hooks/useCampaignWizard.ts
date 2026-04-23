'use client';

import { useState, useCallback } from 'react';
import type {
  CampaignWizardData,
  CampaignWizardState,
  ValidationError,
  StepValidationResult,
} from '@/types/campaign';

const TOTAL_STEPS = 5;

const VALIDATION_RULES: Record<number, (data: Partial<CampaignWizardData>) => ValidationError[]> = {
  1: (data) => {
    const errors: ValidationError[] = [];

    if (!data.name?.trim()) {
      errors.push({ field: 'name', message: 'Campaign name is required', type: 'error' });
    }

    if (data.name && data.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Campaign name must be 100 characters or less',
        type: 'error',
      });
    }

    if (!data.description?.trim()) {
      errors.push({
        field: 'description',
        message: 'Campaign description is required',
        type: 'error',
      });
    }

    if (!data.campaignType) {
      errors.push({
        field: 'campaignType',
        message: 'Please select a campaign type',
        type: 'error',
      });
    }

    if (!data.startDate) {
      errors.push({ field: 'startDate', message: 'Start date is required', type: 'error' });
    }

    if (!data.endDate) {
      errors.push({ field: 'endDate', message: 'End date is required', type: 'error' });
    }

    if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
      errors.push({
        field: 'endDate',
        message: 'End date must be after start date',
        type: 'error',
      });
    }

    return errors;
  },

  2: (data) => {
    const errors: ValidationError[] = [];

    if (!data.targetTiers || data.targetTiers.length === 0) {
      errors.push({
        field: 'targetTiers',
        message: 'Please select at least one target tier',
        type: 'error',
      });
    }

    if (data.minPurchaseAmount !== undefined && data.minPurchaseAmount < 0) {
      errors.push({
        field: 'minPurchaseAmount',
        message: 'Minimum purchase amount must be non-negative',
        type: 'error',
      });
    }

    return errors;
  },

  3: (data) => {
    const errors: ValidationError[] = [];

    if (!data.rewardType) {
      errors.push({
        field: 'rewardType',
        message: 'Please select a reward type',
        type: 'error',
      });
    }

    if (!data.rewardAmount || data.rewardAmount <= 0) {
      errors.push({
        field: 'rewardAmount',
        message: 'Reward amount must be greater than 0',
        type: 'error',
      });
    }

    if (data.rewardType === 'tokens' && !data.tokenContractId) {
      errors.push({
        field: 'tokenContractId',
        message: 'Token contract ID is required for token rewards',
        type: 'error',
      });
    }

    if (data.maxRewardCap && data.maxRewardCap < data.rewardAmount) {
      errors.push({
        field: 'maxRewardCap',
        message: 'Maximum reward cap must be greater than or equal to reward amount',
        type: 'warning',
      });
    }

    return errors;
  },

  4: (data) => {
    const errors: ValidationError[] = [];

    if (data.maxParticipants !== undefined && data.maxParticipants < 1) {
      errors.push({
        field: 'maxParticipants',
        message: 'Maximum participants must be at least 1',
        type: 'error',
      });
    }

    if (data.dailyCap !== undefined && data.dailyCap < 1) {
      errors.push({
        field: 'dailyCap',
        message: 'Daily cap must be at least 1',
        type: 'error',
      });
    }

    if (data.perUserLimit !== undefined && data.perUserLimit < 1) {
      errors.push({
        field: 'perUserLimit',
        message: 'Per-user limit must be at least 1',
        type: 'error',
      });
    }

    return errors;
  },

  5: (data) => {
    const errors: ValidationError[] = [];

    if (!data.acknowledgedTerms) {
      errors.push({
        field: 'acknowledgedTerms',
        message: 'You must acknowledge the terms and conditions',
        type: 'error',
      });
    }

    return errors;
  },
};

export function useCampaignWizard(initialData?: Partial<CampaignWizardData>) {
  const [state, setState] = useState<CampaignWizardState>({
    currentStep: 1,
    data: initialData || {},
    validationErrors: [],
    isLoading: false,
    isSubmitting: false,
  });

  const updateData = useCallback(
    (updates: Partial<CampaignWizardData>) => {
      setState((prev) => ({
        ...prev,
        data: { ...prev.data, ...updates },
      }));
    },
    []
  );

  const validateStep = useCallback((stepNumber: number): StepValidationResult => {
    const rules = VALIDATION_RULES[stepNumber];
    const errors = rules ? rules(state.data) : [];

    setState((prev) => ({
      ...prev,
      validationErrors: errors,
    }));

    return {
      isValid: errors.filter((e) => e.type === 'error').length === 0,
      errors,
    };
  }, [state.data]);

  const nextStep = useCallback(() => {
    const validation = validateStep(state.currentStep);

    if (validation.isValid && state.currentStep < TOTAL_STEPS) {
      setState((prev) => ({
        ...prev,
        currentStep: prev.currentStep + 1,
      }));
      return true;
    }

    return validation.isValid;
  }, [state.currentStep, validateStep]);

  const previousStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1),
      validationErrors: [],
    }));
  }, []);

  const goToStep = useCallback(
    (stepNumber: number) => {
      if (stepNumber >= 1 && stepNumber <= TOTAL_STEPS && stepNumber <= state.currentStep + 1) {
        setState((prev) => ({
          ...prev,
          currentStep: stepNumber,
        }));
      }
    },
    [state.currentStep]
  );

  const resetWizard = useCallback(() => {
    setState({
      currentStep: 1,
      data: {},
      validationErrors: [],
      isLoading: false,
      isSubmitting: false,
    });
  }, []);

  return {
    state,
    updateData,
    validateStep,
    nextStep,
    previousStep,
    goToStep,
    resetWizard,
    currentStep: state.currentStep,
    data: state.data,
    errors: state.validationErrors,
    isValid: state.validationErrors.filter((e) => e.type === 'error').length === 0,
  };
}
