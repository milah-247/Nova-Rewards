# Title: docs: update CONTRIBUTING.md with comprehensive frontend contribution guidelines

### Description:
This PR updates the CONTRIBUTING.md file to provide detailed guidelines for open-source contributors to add features and fix bugs in the Nova Rewards frontend. The updated guide includes step-by-step instructions for getting started, local setup, branching strategy, code standards, testing, and more.

### Key Changes:
- **Getting Started:** Added detailed fork and clone steps with Git commands.
- **Local Setup:** Included instructions for npm install, environment variables, and npm run dev.
- **Branching Strategy:** Defined main (production), develop (integration), feature/*, and fix/* branches.
- **Pull Request Process:** Outlined the complete PR workflow from branch creation to merge.
- **Component Standards:** Specified file naming (PascalCase.tsx), folder structure (components/, hooks/, services/, pages/), and co-located test files (*.test.tsx).
- **Code Style:** Documented ESLint and Prettier enforcement with npm run lint:fix command.
- **Testing:** Added sections on running tests (npm test, npm run test:coverage) and writing tests.
- **Good First Issues:** Included a section linking to GitHub issues labeled "good-first-issue" for new contributors.

### Motivation:
To make the contribution process more accessible and standardized for frontend development, ensuring consistent code quality and easier onboarding for new contributors.

### Testing:
- No code changes that require testing; this is documentation only.
- Verified the markdown formatting and links are correct.
