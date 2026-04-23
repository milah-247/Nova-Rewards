'use client';

import React, { useEffect } from 'react';
import { useCampaignWizard } from '@/hooks/useCampaignWizard';
import type { WizardStep } from '@/types/campaign';
import { WizardProgressIndicator } from '@/components/wizard/WizardProgressIndicator';
import { CampaignWizardStep1 } from '@/components/wizard/Step1BasicInfo';
import { CampaignWizardStep2 } from '@/components/wizard/Step2TargetAudience';
import { CampaignWizardStep3 } from '@/components/wizard/Step3Rewards';
import { CampaignWizardStep4 } from '@/components/wizard/Step4Rules';
import { CampaignWizardStep5 } from '@/components/wizard/Step5Review';

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'Basic Info',
    description: 'Campaign details',
    icon: '📋',
    completed: false,
    active: true,
  },
  {
    id: 2,
    title: 'Target Audience',
    description: 'Who participates',
    icon: '👥',
    completed: false,
    active: false,
  },
  {
    id: 3,
    title: 'Rewards',
    description: 'What to reward',
    icon: '🎁',
    completed: false,
    active: false,
  },
  {
    id: 4,
    title: 'Rules',
    description: 'Operational limits',
    icon: '⚙️',
    completed: false,
    active: false,
  },
  {
    id: 5,
    title: 'Review',
    description: 'Confirm & launch',
    icon: '✅',
    completed: false,
    active: false,
  },
];

export default function CampaignWizardPage() {
  const wizard = useCampaignWizard();
  const [steps, setSteps] = React.useState(WIZARD_STEPS);

  useEffect(() => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => ({
        ...step,
        active: step.id === wizard.currentStep,
        completed: step.id < wizard.currentStep,
      }))
    );
  }, [wizard.currentStep]);

  const handleStepClick = (stepNumber: number) => {
    wizard.goToStep(stepNumber);
  };

  const handleNext = () => {
    const success = wizard.nextStep();
    if (!success) {
      // Validation failed, scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    wizard.previousStep();
  };

  const handleSubmit = async () => {
    const validation = wizard.validateStep(5);
    if (validation.isValid) {
      try {
        // Here you would typically make an API call to create the campaign
        console.log('Campaign data:', wizard.data);
        // Show success message
        alert('Campaign created successfully!');
        // Optionally redirect or reset
        wizard.resetWizard();
      } catch (error) {
        console.error('Error creating campaign:', error);
        alert('Failed to create campaign. Please try again.');
      }
    }
  };

  const isLastStep = wizard.currentStep === WIZARD_STEPS.length;
  const isFirstStep = wizard.currentStep === 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Campaign Creator Wizard
          </h1>
          <p className="text-lg text-gray-600">
            Create a new rewards campaign in just 5 easy steps.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-12 bg-white rounded-lg shadow-sm p-8">
          <WizardProgressIndicator
            steps={steps}
            currentStep={wizard.currentStep}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          {wizard.currentStep === 1 && (
            <CampaignWizardStep1
              data={wizard.data}
              errors={wizard.errors}
              onDataChange={wizard.updateData}
            />
          )}

          {wizard.currentStep === 2 && (
            <CampaignWizardStep2
              data={wizard.data}
              errors={wizard.errors}
              onDataChange={wizard.updateData}
            />
          )}

          {wizard.currentStep === 3 && (
            <CampaignWizardStep3
              data={wizard.data}
              errors={wizard.errors}
              onDataChange={wizard.updateData}
            />
          )}

          {wizard.currentStep === 4 && (
            <CampaignWizardStep4
              data={wizard.data}
              errors={wizard.errors}
              onDataChange={wizard.updateData}
            />
          )}

          {wizard.currentStep === 5 && (
            <CampaignWizardStep5
              data={wizard.data}
              errors={wizard.errors}
              onDataChange={wizard.updateData}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              isFirstStep
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400'
            }`}
          >
            ← Previous
          </button>

          <div className="text-sm text-gray-600 font-medium">
            Step {wizard.currentStep} of {WIZARD_STEPS.length}
          </div>

          {!isLastStep ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:bg-green-800 transition-all flex items-center gap-2"
            >
              <span>✓</span>
              Confirm & Launch
            </button>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="mt-6 md:hidden flex flex-col gap-2">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
              isFirstStep
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-900'
            }`}
          >
            ← Previous
          </button>
          {!isLastStep ? (
            <button
              onClick={handleNext}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              ✓ Confirm & Launch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
