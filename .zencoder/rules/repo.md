# Repository Overview

## Purpose
This project is a Next.js application that generates AI-assisted case studies. Users provide a topic, the backend crafts sectioned content using templated prompts, and the UI displays results with token usage details.

## Key Technologies
- **Next.js (App Router)** for pages and API routes
- **TypeScript** on both client and server
- **CSS Modules** for scoped component styling
- **Google Gemini** integration for content generation

## Important Files & Directories
- **`src/app/page.tsx`**: Client UI handling topic submission, response rendering, and Google Docs export.
- **`src/app/api/generate/route.ts`**: API endpoint that runs prompt templates against Gemini and tracks tokens.
- **`src/lib/prompts.ts`**: Prompt template definitions for each case study section.
- **`src/lib/tokenTracker.ts`**: Helpers for allowance tracking persisted between requests.
- **`models.json`**: Lists available model configurations.

## Typical Workflow
1. **Install dependencies**: `npm install`
2. **Start development server**: `npm run dev`
3. **Configure environment variables** via `.env.local` (API keys, model, allowance, Apps Script URL, etc.).

## Additional Notes
- Generated sections render inside accordion components for easy browsing.
- Token counters only appear after a successful generation.
- Frontend can export generated text to Google Docs via a configured Apps Script endpoint.