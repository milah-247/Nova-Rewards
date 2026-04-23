'use client';

import React from 'react';
import type { WizardStep } from '@/types/campaign';

interface WizardProgressIndicatorProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick: (stepNumber: number) => void;
}

export function WizardProgressIndicator({
  steps,
  currentStep,
  onStepClick,
}: WizardProgressIndicatorProps) {
  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center flex-1">
              <button
                onClick={() => onStepClick(step.id)}
                disabled={step.id > currentStep}
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-semibold
                  transition-all duration-200 mb-2
                  ${
                    step.id === currentStep
                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                      : step.id < currentStep
                        ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }
                `}
              >
                {step.id < currentStep ? '✓' : step.id}
              </button>
              <div className="text-center text-sm">
                <p className="font-medium text-gray-900">{step.title}</p>
                <p className="text-gray-500 text-xs">{step.description}</p>
              </div>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 mb-6 transition-colors ${
                  step.id < currentStep ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
