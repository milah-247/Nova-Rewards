'use client';

import React, { useState } from 'react';
import type { ContextualHelpItem } from '@/types/campaign';

interface ContextualHelpProps {
  helpItem: ContextualHelpItem;
  trigger?: 'hover' | 'click';
}

export function ContextualHelp({
  helpItem,
  trigger = 'hover',
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTrigger = () => {
    if (trigger === 'click') {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => trigger === 'hover' && setIsOpen(true)}
        onMouseLeave={() => trigger === 'hover' && setIsOpen(false)}
        onClick={handleTrigger}
        className="inline-flex items-center justify-center w-5 h-5 ml-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full"
        title="Click for help"
      >
        <span className="text-sm font-bold">?</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <h4 className="font-semibold text-gray-900 mb-2">
            {helpItem.title}
          </h4>
          <p className="text-sm text-gray-600 mb-3">
            {helpItem.description}
          </p>

          {helpItem.examples && helpItem.examples.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Examples:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                {helpItem.examples.map((example, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {helpItem.link && (
            <a
              href={helpItem.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Learn more →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

interface ContextualHelpTooltipProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function HelpTooltipWrapper({
  title,
  description,
  children,
}: ContextualHelpTooltipProps) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <ContextualHelp
        helpItem={{
          fieldName: 'inline-help',
          title,
          description,
        }}
      />
    </div>
  );
}
