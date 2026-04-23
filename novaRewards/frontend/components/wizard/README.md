# Campaign Wizard - Multi-Step Creation Wizard

This directory contains the complete implementation of the **Multi-Step Campaign Creation Wizard** for merchants to create rewards campaigns with a progressive, user-friendly flow.

## 📋 Overview

The campaign wizard guides merchants through 5 logical steps to create and launch a rewards campaign:

1. **Basic Information** - Campaign name, description, type, and duration
2. **Target Audience** - User tiers, eligibility rules, and geographic restrictions
3. **Rewards Configuration** - Reward type, amount, and limits
4. **Campaign Rules** - Operational constraints, daily caps, and participant limits
5. **Review & Confirmation** - Campaign overview and terms acknowledgment

## 🏗️ Architecture

### File Structure

```
frontend/
├── app/
│   └── campaign-wizard/
│       └── page.tsx          # Main wizard page
├── components/
│   └── wizard/
│       ├── WizardProgressIndicator.tsx    # Progress bar component
│       ├── ValidationError.tsx            # Error display components
│       ├── ContextualHelp.tsx             # Tooltips and help text
│       ├── Step1BasicInfo.tsx             # Step 1 form
│       ├── Step2TargetAudience.tsx        # Step 2 form
│       ├── Step3Rewards.tsx               # Step 3 form
│       ├── Step4Rules.tsx                 # Step 4 form
│       └── Step5Review.tsx                # Step 5 review
├── hooks/
│   └── useCampaignWizard.ts               # Wizard state management
├── types/
│   └── campaign.ts                        # Type definitions
└── lib/
    └── validation.ts                      # Validation rules (optional)
```

## 🎯 Key Features

### 1. **Multi-Step Form with Progress Indicator**
- Visual progress indicator showing completed, current, and upcoming steps
- Clickable step badges to jump to completed steps
- Clear step titles and descriptions

### 2. **Inline Validation & Error States**
- Real-time field validation as users type
- Visual error states with red borders and background
- Error summary at the top of each step
- Field-level error messages

### 3. **Contextual Help & Tooltips**
- Help icons (?) next to complex fields
- Hover/click-triggered tooltips with:
  - Field descriptions
  - Examples
  - Links to documentation
- Examples for eligibility rules, token configuration, and more

### 4. **Progressive Disclosure**
- Step-by-step form breakdown reduces cognitive load
- Related fields grouped together
- Conditional fields (e.g., token config only shown for token rewards)
- Budget impact summary for planning

### 5. **Mobile Responsive Design**
- Adapts to all screen sizes
- Touch-friendly buttons and inputs
- Stacked layout on mobile
- Button alternatives for small screens

### 6. **Comprehensive Type Safety**
- Full TypeScript support with strict mode
- Type definitions for all campaign data structures
- Validation result types

## 📝 Component Documentation

### `useCampaignWizard` Hook

The main state management hook for the wizard.

```typescript
const wizard = useCampaignWizard();

// Available methods:
wizard.updateData(updates)           // Update wizard data
wizard.nextStep()                    // Move to next step with validation
wizard.previousStep()                // Move to previous step
wizard.goToStep(stepNumber)          // Jump to specific step
wizard.validateStep(stepNumber)      // Validate a specific step
wizard.resetWizard()                 // Reset all data and go to step 1

// Available properties:
wizard.currentStep                   // Current step number (1-5)
wizard.data                          // Current form data
wizard.errors                        // Validation errors
wizard.isValid                       // Whether current step is valid
wizard.state                         // Full state object
```

### Validation Rules

Validation occurs at each step:

- **Step 1**: Campaign name, description, type, dates
- **Step 2**: Target tiers, eligibility rules
- **Step 3**: Reward type, amount, token configuration
- **Step 4**: Numeric limits validation
- **Step 5**: Terms acknowledgment

### Component Props

All step components follow the same prop structure:

```typescript
interface StepProps {
  data: Partial<CampaignWizardData>
  errors: ValidationError[]
  onDataChange: (updates: Partial<CampaignWizardData>) => void
}
```

## 🎨 Design System Integration

### Color Scheme

- **Blue (#3B82F6)**: Primary action, active state
- **Green (#22C55E)**: Success, completed steps
- **Red (#DC2626)**: Errors
- **Yellow (#EAB308)**: Warnings, important notes
- **Gray**: Neutral backgrounds and text

### Typography

- **Headings**: Bold, large font sizes (2xl-4xl)
- **Labels**: Semi-bold for field labels
- **Help Text**: Smaller, gray text for descriptions
- **Errors**: Bold, colored text with icons

### Spacing

- Step content: 8 units (32px) between major sections
- Form fields: 6 units (24px) gap between groups
- Internal field gaps: 2 units (8px)

## 🔧 Usage Example

```tsx
import CampaignWizardPage from '@/app/campaign-wizard/page'

// Direct import in your app
<CampaignWizardPage />

// Or add route to your navigation
<Link href="/campaign-wizard">Create Campaign</Link>
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

- [ ] All 5 steps render correctly
- [ ] Progress indicator shows correct state
- [ ] Validation errors display on invalid input
- [ ] Help tooltips appear on hover/click
- [ ] Next/Previous buttons work correctly
- [ ] Can jump to completed steps
- [ ] Cannot jump to incomplete steps
- [ ] Form data persists between steps
- [ ] Mobile layout is responsive
- [ ] Step 5 review shows all entered data

### Validation Testing

- [ ] Empty required fields show errors
- [ ] Date validation (end after start)
- [ ] Numeric fields validate ranges
- [ ] Email/URL validation if added
- [ ] Terms acknowledgment required for submission

## 📱 Mobile Optimization

The wizard is fully responsive:

- **Desktop**: Side-by-side layouts, tooltips on hover
- **Tablet**: Adapted grid layouts
- **Mobile**: Stacked layouts, click tooltips, full-width buttons

## 🔐 Security Considerations

- All user inputs are sanitized before API submission
- Sensitive fields (token contract IDs) not logged
- CSRF tokens included in form submissions
- Rate limiting on campaign creation endpoint

## 🚀 Future Enhancements

- [ ] Auto-save draft campaigns
- [ ] Campaign templates for common scenarios
- [ ] A/B testing variants
- [ ] Bulk campaign import from CSV
- [ ] Campaign scheduling with timezone support
- [ ] Advanced targeting with segment builder
- [ ] Real-time budget calculator with historical data

## 📚 Related Documentation

- [Campaign Types & Eligibility Rules](../docs/campaigns.md)
- [Stellar Token Integration](../docs/stellar-integration.md)
- [Validation Patterns](../docs/validation.md)
- [Form Design System](../docs/forms.md)

## 🤝 Contributing

When adding new fields to the wizard:

1. Add type definition in `types/campaign.ts`
2. Add validation rule in `useCampaignWizard.ts`
3. Create component for the field
4. Add contextual help tooltip
5. Update TypeScript types
6. Test on mobile and desktop

---

**Last Updated**: April 23, 2026  
**Maintained By**: Frontend Team  
**Status**: Production Ready
