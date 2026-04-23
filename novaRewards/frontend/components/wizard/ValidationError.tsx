'use client';

import React from 'react';
import type { ValidationError } from '@/types/campaign';

interface ValidationErrorProps {
  errors?: ValidationError[];
  fieldName?: string;
}

export function ValidationErrorDisplay({
  errors,
  fieldName,
}: ValidationErrorProps) {
  if (!errors || errors.length === 0) {
    return null;
  }

  const filteredErrors = fieldName
    ? errors.filter((e) => e.field === fieldName)
    : errors;

  if (filteredErrors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {filteredErrors.map((error, index) => (
        <div
          key={index}
          className={`text-sm font-medium flex items-start gap-2 ${
            error.type === 'error' ? 'text-red-600' : 'text-yellow-600'
          }`}
        >
          <span className="mt-0.5">
            {error.type === 'error' ? '✕' : '⚠'}
          </span>
          <span>{error.message}</span>
        </div>
      ))}
    </div>
  );
}

interface StepErrorSummaryProps {
  errors: ValidationError[];
}

export function StepErrorSummary({ errors }: StepErrorSummaryProps) {
  const criticalErrors = errors.filter((e) => e.type === 'error');

  if (criticalErrors.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
        <span>⚠ Please fix the following errors:</span>
      </h3>
      <ul className="space-y-1 list-disc list-inside text-red-700 text-sm">
        {criticalErrors.map((error, index) => (
          <li key={index}>
            <strong>{error.field}:</strong> {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
